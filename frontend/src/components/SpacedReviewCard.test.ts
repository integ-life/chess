import { describe, expect, it } from 'vitest'
import { reviewDates } from './SpacedReviewCard'

describe('spaced review schedule', () => {
  it('schedules the initial, next-day and seven-day reviews', () => {
    const start = new Date(2026, 6, 11, 12).getTime()
    expect(reviewDates(start).map((value) => new Date(value).getDate())).toEqual([11, 12, 18])
  })
})
