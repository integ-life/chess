import { describe, expect, it } from 'vitest'
import { mateExamples, mateLessons, mateTransferExamples } from './mates'
import { fromFEN } from '../chess/fen'
import { gameStatus, legalMoves } from '../chess/movegen'
import { moveFromICCS } from '../chess/notation'
import { makeMove } from '../chess/position'
import { mateExercises, mateReviewExercises } from './exercises/mates'

const titleEvidence: Record<string, RegExp> = {
  'flying-general': /白脸将|对面笑/, 'double-rook': /双车错/, 'double-cannon': /重炮|天地炮/,
  smothered: /闷宫|闷杀/, 'reclining-horse': /卧槽马/, 'corner-horse': /挂角马|八角马/,
  'horse-cannon': /马后炮/, 'iron-gate': /铁门栓|夹车炮/, 'bold-heart': /大胆穿心|三子归边/, stalemate: /困毙/,
}

describe('basic mate course', () => {
  it('keeps concept and review exercises separate from lesson prose', () => {
    expect(Object.keys(mateExercises)).toEqual(mateLessons.map((lesson) => lesson.id))
    expect(Object.keys(mateReviewExercises)).toEqual(mateLessons.map((lesson) => lesson.id))
    expect(mateLessons.every((lesson) => lesson.quiz === mateExercises[lesson.id as keyof typeof mateExercises])).toBe(true)
    expect(mateLessons.every((lesson) => lesson.reviewPrompts === mateReviewExercises[lesson.id as keyof typeof mateReviewExercises])).toBe(true)
    expect(Object.values(mateExercises).flatMap((exercise) => exercise.choices).every((choice) => choice.feedback.length >= 55)).toBe(true)
    const reviewPrompts = Object.values(mateReviewExercises).flat()
    expect(reviewPrompts).toHaveLength(50)
    expect(new Set(reviewPrompts).size).toBe(reviewPrompts.length)
    expect(reviewPrompts.every((prompt) => prompt.length >= 55)).toBe(true)
  })

  it('has ten sourced, detailed and rule-valid lessons', () => {
    expect(mateLessons).toHaveLength(10)
    for (const lesson of mateLessons) {
      const example = mateExamples[lesson.id]
      expect(lesson.explanation).toHaveLength(3)
      for (const section of lesson.explanation) expect(section.body.length, `${lesson.id}: ${section.title}`).toBeGreaterThanOrEqual(70)
      expect(lesson.pattern.length).toBeGreaterThanOrEqual(3)
      expect(lesson.steps).toHaveLength(example.moves.length)
      expect(lesson.quiz.choices.filter((choice) => choice.correct)).toHaveLength(1)
      expect(example.sourceUrl).toMatch(/^https:\/\/github\.com\/chasoft\//)

      let position = fromFEN(example.initialFen)
      for (const iccs of example.moves) {
        const move = moveFromICCS(iccs)
        expect(legalMoves(position)).toContainEqual(move)
        position = makeMove(position, move)
      }
      expect(gameStatus(position), lesson.id).toBe(lesson.id === 'stalemate' ? 'stalemate' : 'checkmate')
    }
  })

  it('uses a distinct sourced and terminal transfer position for every mate', () => {
    expect(Object.keys(mateTransferExamples)).toHaveLength(10)
    for (const lesson of mateLessons) {
      const example = mateTransferExamples[lesson.id]
      expect(example.id).not.toBe(mateExamples[lesson.id].id)
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
      expect(gameStatus(position), `${lesson.id} transfer terminal`).toBe(lesson.id === 'stalemate' ? 'stalemate' : 'checkmate')
    }
  })
})
