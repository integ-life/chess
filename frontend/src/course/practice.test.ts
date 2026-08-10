import { describe, expect, it } from 'vitest'
import { fromFEN } from '../chess/fen'
import { legalMoves } from '../chess/movegen'
import { moveFromICCS } from '../chess/notation'
import { makeMove } from '../chess/position'
import { practiceExercises, practiceReviewExercises } from './exercises/practice'
import { practiceExamples, practiceLessons } from './practice'

const titleEvidence: Record<string, RegExp> = {
  candidates: /抢先发难/,
  'forced-quiet': /以静制动/,
  'best-reply': /将计就计/,
  blundercheck: /饵兵勿食/,
  clock: /计算偏颇.*错失战机/,
  annotate: /经典评注/,
  'self-review': /妙手和漏着/,
  'engine-review': /计算机博弈锦标赛/,
  repertoire: /许银川.*卓赞烽/,
  graduation: /赵国荣.*吕钦/,
}

describe('calculation and review course', () => {
  it('keeps concept and delayed-review exercises separate from lesson prose', () => {
    expect(Object.keys(practiceExercises)).toEqual(practiceLessons.map((lesson) => lesson.id))
    expect(practiceLessons.every((lesson) => lesson.quiz === practiceExercises[lesson.id as keyof typeof practiceExercises])).toBe(true)
    expect(Object.values(practiceExercises).flatMap((exercise) => exercise.choices).every((choice) => choice.feedback.length >= 55)).toBe(true)
    expect(Object.keys(practiceReviewExercises)).toEqual(practiceLessons.map((lesson) => lesson.id))
    expect(practiceLessons.every((lesson) => lesson.reviewPrompts === practiceReviewExercises[lesson.id as keyof typeof practiceReviewExercises])).toBe(true)
    const reviewPrompts = Object.values(practiceReviewExercises).flat()
    expect(reviewPrompts).toHaveLength(50)
    expect(new Set(reviewPrompts).size).toBe(reviewPrompts.length)
    expect(reviewPrompts.every((prompt) => prompt.length >= 55)).toBe(true)
  })

  it('keeps 10 sourced, detailed lessons with legal complete games', () => {
    expect(practiceLessons).toHaveLength(10)
    expect(practiceLessons.slice(6, 8).map((lesson) => lesson.id)).toEqual(['self-review', 'engine-review'])
    for (const lesson of practiceLessons) {
      const example = practiceExamples[lesson.id]
      expect(example).toBeTruthy()
      expect(example.title).toMatch(titleEvidence[lesson.id])
      expect(example.sourceName).toMatch(/Vietcotuong|World Chess Federation|Dongping Chess/)
      expect(example.sourceUrl).toMatch(/^https:\/\/github\.com\//)
      expect(example.moves).toHaveLength(5)
      expect(example.fullMoves!.length).toBeGreaterThanOrEqual(20)
      expect(lesson.explanation).toHaveLength(3)
      expect(lesson.explanation.every((section) => section.body.length >= 70)).toBe(true)
      expect(lesson.pattern).toHaveLength(3)
      expect(lesson.deliverable).toHaveLength(3)
      expect(lesson.deliverable!.every((item) => item.length >= 18), `${lesson.id}: deliverable detail`).toBe(true)
      expect(lesson.steps).toHaveLength(5)
      expect(lesson.quiz.choices).toHaveLength(3)
      expect(lesson.quiz.choices.filter((choice) => choice.correct)).toHaveLength(1)

      let position = fromFEN(example.initialFen)
      for (const iccs of example.fullMoves!) {
        const move = moveFromICCS(iccs)
        expect(legalMoves(position), `${lesson.id}: ${iccs}`).toContainEqual(move)
        position = makeMove(position, move)
      }
    }
  })
})
