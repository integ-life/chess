import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Exploration, Game } from '../api/client'

// 本地记录 = 服务端行 + dirty 标记（待上行）+ 当前登录用户归属（隔离旧本地数据）
export type LocalGame = Game & { dirty?: boolean; ownerUserId?: number }
export type LocalExploration = Exploration & { dirty?: boolean }
export interface LocalCourseProgress {
  lessonKey: string
  plannedAt: number
  done: boolean[]
  updatedAt: number
  dirty?: boolean
  ownerUserId?: number
}

interface ChessDB extends DBSchema {
  games: { key: string; value: LocalGame }
  explorations: { key: string; value: LocalExploration }
  courseProgress: { key: string; value: LocalCourseProgress }
  meta: { key: string; value: number }
}

let dbp: Promise<IDBPDatabase<ChessDB>> | null = null

export function db(): Promise<IDBPDatabase<ChessDB>> {
  dbp ??= openDB<ChessDB>('chess', 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('games', { keyPath: 'id' })
        d.createObjectStore('explorations', { keyPath: 'id' })
        d.createObjectStore('meta')
      }
      if (oldVersion < 2) {
        d.createObjectStore('courseProgress', { keyPath: 'lessonKey' })
      }
    },
  })
  return dbp
}

export async function clearLocalData(): Promise<void> {
  const d = await db()
  await Promise.all([d.clear('games'), d.clear('explorations'), d.clear('courseProgress'), d.clear('meta')])
}
