import { useEffect, useId, useState } from 'react'
import { getCourseProgress, saveCourseProgress } from '../offline/courseProgress'
import { useSyncStore } from '../offline/syncQueue'

interface ReviewProgress {
  plannedAt: number
  done: boolean[]
}

// oxlint-disable-next-line react/only-export-components -- exported for the schedule regression check
export function reviewDates(plannedAt: number) {
  return [0, 1, 7].map((days) => {
    const date = new Date(plannedAt)
    date.setDate(date.getDate() + days)
    return date.getTime()
  })
}

export default function SpacedReviewCard({ lessonKey, prompts, ready, readyHint }: { lessonKey: string; prompts: readonly string[]; ready: boolean; readyHint: string }) {
  const headingId = useId()
  const syncVersion = useSyncStore((state) => state.syncVersion)
  const [progress, setProgress] = useState<ReviewProgress | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setLoaded(false)
    void getCourseProgress(lessonKey).then((value) => {
      if (active) {
        setProgress(value ? { plannedAt: value.plannedAt, done: value.done } : null)
        setLoaded(true)
      }
    })
    return () => { active = false }
  }, [lessonKey, syncVersion])

  function save(next: ReviewProgress) {
    setProgress(next)
    void saveCourseProgress({ lessonKey, ...next })
  }

  function schedule() {
    save({ plannedAt: Date.now(), done: [true, false, false] })
  }

  function toggle(index: number) {
    if (!progress) return
    save({ ...progress, done: progress.done.map((value, item) => item === index ? !value : value) })
  }

  const dates = progress ? reviewDates(progress.plannedAt) : []
  const labels = ['本课完成', '次日复习', '七日复习']

  return <section className="course-review" aria-labelledby={headingId}>
    <div><p className="opening-course__eyebrow">延迟复习</p><h3 id={headingId}>今天理解，明天还能独立做出</h3><p>不要重读全文，先完成下面的主动回忆：</p></div>
    <ul>{prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>
    {!loaded ? <button className="course-review__schedule" disabled type="button">正在读取学习进度…</button> : progress ? <>
      <div className="course-review__checks">{labels.map((label, index) => <label key={label}><input checked={progress.done[index]} onChange={() => toggle(index)} type="checkbox" /><span><strong>{label}</strong><small>{new Date(dates[index]).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</small></span></label>)}</div>
      <p className="course-review__status">{progress.done.every(Boolean) ? '本轮复习完成。进度已纳入账号同步；实战遇到相同结构时，可以再回来更新批注。' : '进度会随账号同步；离线时也可继续完成，联网后自动合并。'}</p>
    </> : <button className="course-review__schedule" disabled={!ready} onClick={schedule} type="button">{ready ? '完成本课并安排复习' : readyHint}</button>}
  </section>
}
