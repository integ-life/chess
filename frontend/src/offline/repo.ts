// 本地优先数据层：所有页面读写 IndexedDB，保存后触发后台同步。
import { normalizeGame } from '../api/client'
import type { Exploration, Game } from '../api/client'
import { useAuthStore } from '../auth'
import { db } from './db'
import { syncNow } from './syncQueue'
import { lineToVariationTree } from '../qipu/tree'

export async function listGames(): Promise<Game[]> {
  const userId = useAuthStore.getState().user?.id
  if (!userId) return []
  const rows = await (await db()).getAll('games')
  return rows
    .filter((g) => !g.deleted && (g.ownerUserId === userId || (g.ownerUserId === undefined && !g.dirty)))
    .map(normalizeGame)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getGame(id: string): Promise<Game | undefined> {
  const g = await (await db()).get('games', id)
  return g && !g.deleted ? normalizeGame(g) : undefined
}

export async function saveGame(g: Game): Promise<void> {
  const ownerUserId = useAuthStore.getState().user?.id
  const game = normalizeGame(g)
  await (await db()).put('games', {
    ...game,
    tree: game.tree ?? lineToVariationTree(game.moves, game.initialFen, { nodeIdPrefix: game.id }),
    ownerUserId,
    dirty: true,
  })
  void syncNow()
}

export async function removeGame(id: string): Promise<void> {
  const d = await db()
  const g = await d.get('games', id)
  if (g) {
    await d.put('games', { ...g, deleted: true, updatedAt: Date.now(), dirty: true })
    void syncNow()
  }
}

export async function listExplorations(): Promise<Exploration[]> {
  const rows = await (await db()).getAll('explorations')
  return rows.filter((e) => !e.deleted).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getExploration(id: string): Promise<Exploration | undefined> {
  const e = await (await db()).get('explorations', id)
  return e && !e.deleted ? e : undefined
}

export async function saveExploration(e: Exploration): Promise<void> {
  await (await db()).put('explorations', { ...e, dirty: true })
  void syncNow()
}

export async function removeExploration(id: string): Promise<void> {
  const d = await db()
  const e = await d.get('explorations', id)
  if (e) {
    await d.put('explorations', { ...e, deleted: true, updatedAt: Date.now(), dirty: true })
    void syncNow()
  }
}
