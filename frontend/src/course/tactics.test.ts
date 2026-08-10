import { describe, expect, it } from 'vitest'
import { tacticExamples, tacticLessons, tacticTransferExamples } from './tactics'
import { fromFEN } from '../chess/fen'
import { legalMoves } from '../chess/movegen'
import { moveFromICCS } from '../chess/notation'
import { makeMove } from '../chess/position'
import { tacticExercises, tacticReviewExercises } from './exercises/tactics'

const titleEvidence: Record<string, RegExp> = {
  fork: /捉.*双/, skewer: /串打/, pin: /牵制/, discovered: /闪击/, deflection: /引离/,
  blockage: /堵塞/, interference: /拦截/, defender: /除根/, exchange: /兑子/, zwischenzug: /顿挫/,
}

describe('basic tactics course', () => {
  it('keeps concept and review exercises separate from lesson prose', () => {
    expect(Object.keys(tacticExercises)).toEqual(tacticLessons.map((lesson) => lesson.id))
    expect(Object.keys(tacticReviewExercises)).toEqual(tacticLessons.map((lesson) => lesson.id))
    expect(tacticLessons.every((lesson) => lesson.quiz === tacticExercises[lesson.id as keyof typeof tacticExercises])).toBe(true)
    expect(tacticLessons.every((lesson) => lesson.reviewPrompts === tacticReviewExercises[lesson.id as keyof typeof tacticReviewExercises])).toBe(true)
    expect(Object.values(tacticExercises).flatMap((exercise) => exercise.choices).every((choice) => choice.feedback.length >= 55)).toBe(true)
    const reviewPrompts = Object.values(tacticReviewExercises).flat()
    expect(reviewPrompts).toHaveLength(50)
    expect(new Set(reviewPrompts).size).toBe(reviewPrompts.length)
    expect(reviewPrompts.every((prompt) => prompt.length >= 55)).toBe(true)
  })

  it('has ten detailed, sourced and legal five-ply lessons', () => {
    expect(tacticLessons).toHaveLength(10)
    for (const lesson of tacticLessons) {
      const example = tacticExamples[lesson.id]
      expect(example.title).toMatch(titleEvidence[lesson.id])
      expect(example.moves).toHaveLength(5)
      expect(example.sourceUrl).toMatch(/^https:\/\/github\.com\/chasoft\//)
      expect(lesson.explanation).toHaveLength(3)
      for (const section of lesson.explanation) expect(section.body.length, `${lesson.id}: ${section.title}`).toBeGreaterThanOrEqual(70)
      expect(lesson.pattern.length).toBeGreaterThanOrEqual(3)
      expect(lesson.steps).toHaveLength(example.moves.length)
      expect(lesson.quiz.choices.filter((choice) => choice.correct)).toHaveLength(1)

      let position = fromFEN(example.initialFen)
      for (const iccs of example.moves) {
        const move = moveFromICCS(iccs)
        const moves = legalMoves(position)
        expect(moves, `${lesson.id}: ${iccs}`).toContainEqual(move)
        position = makeMove(position, move)
      }
    }
  })

  it('uses a distinct sourced and legal transfer position for every tactic', () => {
    expect(Object.keys(tacticTransferExamples)).toHaveLength(10)
    for (const lesson of tacticLessons) {
      const example = tacticTransferExamples[lesson.id]
      expect(example.id).not.toBe(tacticExamples[lesson.id].id)
      expect(example.title).toMatch(titleEvidence[lesson.id])
      expect(example.moves).toHaveLength(5)
      expect(example.sourceUrl).toMatch(/^https:\/\/github\.com\/chasoft\//)
      expect(lesson.transferNote?.length).toBeGreaterThanOrEqual(45)
      expect(lesson.defenseNote?.length, `${lesson.id}: defense`).toBeGreaterThanOrEqual(65)

      let position = fromFEN(example.initialFen)
      for (const iccs of example.moves) {
        const move = moveFromICCS(iccs)
        expect(legalMoves(position), `${lesson.id} transfer: ${iccs}`).toContainEqual(move)
        position = makeMove(position, move)
      }
    }
  })
})
