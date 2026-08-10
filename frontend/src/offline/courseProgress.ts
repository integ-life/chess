import { useAuthStore } from '../auth'
import { db, type LocalCourseProgress } from './db'
import { syncNow } from './syncQueue'

const legacyPrefix = 'chess.course.review.'

function normalize(progress: LocalCourseProgress): LocalCourseProgress {
  return {
    ...progress,
    done: [Boolean(progress.done[0]), Boolean(progress.done[1]), Boolean(progress.done[2])],
  }
}

export async function getCourseProgress(lessonKey: string): Promise<LocalCourseProgress | null> {
  const d = await db()
  const userId = useAuthStore.getState().user?.id
  const stored = await d.get('courseProgress', lessonKey)
  if (stored && stored.ownerUserId === userId) return normalize(stored)

  try {
    const legacyKey = `${legacyPrefix}${lessonKey}`
    const legacy = JSON.parse(localStorage.getItem(legacyKey) ?? 'null') as Partial<LocalCourseProgress> | null
    if (legacy && typeof legacy.plannedAt === 'number' && Array.isArray(legacy.done)) {
      const migrated = normalize({
        lessonKey,
        plannedAt: legacy.plannedAt,
        done: legacy.done,
        updatedAt: Date.now(),
        ownerUserId: userId,
        dirty: true,
      })
      await d.put('courseProgress', migrated)
      localStorage.removeItem(legacyKey)
      void syncNow()
      return migrated
    }
  } catch {
    // Ignore malformed or unavailable legacy localStorage data.
  }
  return null
}

export async function saveCourseProgress(progress: Omit<LocalCourseProgress, 'updatedAt' | 'dirty' | 'ownerUserId'>): Promise<LocalCourseProgress> {
  const saved = normalize({
    ...progress,
    updatedAt: Date.now(),
    ownerUserId: useAuthStore.getState().user?.id,
    dirty: true,
  })
  await (await db()).put('courseProgress', saved)
  void syncNow()
  return saved
}
