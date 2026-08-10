import { create } from 'zustand'
import { db } from './db'
import { apiUrl, normalizeGame } from '../api/client'
import { authToken, useAuthStore } from '../auth'

interface SyncState {
  online: boolean
  syncing: boolean
  // 每次同步完成 +1，页面据此刷新列表
  syncVersion: number
  lastError: string | null
}

export const useSyncStore = create<SyncState>(() => ({
  online: navigator.onLine,
  syncing: false,
  syncVersion: 0,
  lastError: null,
}))

let running = false

// push 所有 dirty 行 → pull 增量 → 本地 LWW 应用
export async function syncNow(): Promise<void> {
  if (running || !navigator.onLine) return
  const token = authToken()
  if (!token) return
  running = true
  useSyncStore.setState({ syncing: true, lastError: null })
  try {
    const d = await db()
    const userId = useAuthStore.getState().user?.id
    const games = (await d.getAll('games')).filter((g) => g.dirty && g.ownerUserId === userId)
    const explorations = (await d.getAll('explorations')).filter((e) => e.dirty)
    const courseProgress = (await d.getAll('courseProgress')).filter((p) => p.dirty && p.ownerUserId === userId)
    const since = (await d.get('meta', 'lastSyncAt')) ?? 0

    const strip = <T extends { dirty?: boolean; ownerUserId?: number }>(rows: T[]) =>
      rows.map(({ dirty: _dirty, ownerUserId: _ownerUserId, ...rest }) => rest)

    const pushRes = await fetch(apiUrl('/sync/push'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: strip(games), explorations: strip(explorations), courseProgress: strip(courseProgress) }),
    })
    if (!pushRes.ok) throw new Error(`push failed: HTTP ${pushRes.status}`)
    const pushed = (await pushRes.json()) as { applied: string[]; conflicts?: string[] }
    const appliedIds = new Set(pushed.applied)
    const conflictIds = new Set(pushed.conflicts ?? [])

    // 清除已上行行的 dirty（若期间未再编辑）
    for (const g of games) {
      if (!appliedIds.has(g.id)) continue
      const cur = await d.get('games', g.id)
      if (cur && cur.updatedAt === g.updatedAt) await d.put('games', { ...cur, dirty: false })
    }
    for (const e of explorations) {
      if (!appliedIds.has(e.id)) continue
      const cur = await d.get('explorations', e.id)
      if (cur && cur.updatedAt === e.updatedAt) await d.put('explorations', { ...cur, dirty: false })
    }
    for (const progress of courseProgress) {
      if (!appliedIds.has(progress.lessonKey)) continue
      const current = await d.get('courseProgress', progress.lessonKey)
      if (current && current.updatedAt === progress.updatedAt) await d.put('courseProgress', { ...current, dirty: false })
    }

    const pullSince = conflictIds.size > 0 ? 0 : since
    const pullRes = await fetch(apiUrl(`/sync/pull?since=${pullSince}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!pullRes.ok) throw new Error(`pull failed: HTTP ${pullRes.status}`)
    const pull = (await pullRes.json()) as {
      games: import('./db').LocalGame[]
      explorations: import('./db').LocalExploration[]
      courseProgress: import('./db').LocalCourseProgress[]
      serverTime: number
    }
    for (const row of pull.games) {
      const local = await d.get('games', row.id)
      if (!local || row.updatedAt > local.updatedAt || conflictIds.has(row.id)) {
        await d.put('games', { ...normalizeGame(row), ownerUserId: userId, dirty: false })
      }
    }
    for (const row of pull.explorations) {
      const local = await d.get('explorations', row.id)
      if (!local || row.updatedAt > local.updatedAt || conflictIds.has(row.id)) {
        await d.put('explorations', { ...row, dirty: false })
      }
    }
    for (const row of pull.courseProgress ?? []) {
      const local = await d.get('courseProgress', row.lessonKey)
      if (!local || row.updatedAt > local.updatedAt || conflictIds.has(row.lessonKey)) {
        await d.put('courseProgress', { ...row, ownerUserId: userId, dirty: false })
      }
    }
    await d.put('meta', pull.serverTime, 'lastSyncAt')
    useSyncStore.setState((s) => ({ syncing: false, syncVersion: s.syncVersion + 1 }))
  } catch (err) {
    useSyncStore.setState({
      syncing: false,
      lastError: err instanceof Error ? err.message : String(err),
    })
  } finally {
    running = false
  }
}

// 应用启动时调用一次：注册在线/离线监听
export function initSync() {
  window.addEventListener('online', () => {
    useSyncStore.setState({ online: true })
    void syncNow()
  })
  window.addEventListener('offline', () => useSyncStore.setState({ online: false }))
  void syncNow()
}
