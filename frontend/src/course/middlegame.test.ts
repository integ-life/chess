import { describe, expect, it } from 'vitest'
import { fromFEN } from '../chess/fen'
import { legalMoves } from '../chess/movegen'
import { moveFromICCS } from '../chess/notation'
import { makeMove } from '../chess/position'
import { middlegameExercises, middlegameReviewExercises } from './exercises/middlegame'
import { middlegameExamples, middlegameLessons, middlegameTransferExamples } from './middlegame'

const titleEvidence: Record<string, RegExp> = {
  material: /子力的价值/,
  initiative: /子与势的关系/,
  'worst-piece': /子力的位置/,
  'open-lines': /横线攻杀/,
  'horse-quality': /退马败着/,
  'cannon-position': /退炮败手/,
  'pawn-structure': /平兵失误/,
  'king-safety': /弃车杀士破城池/,
  simplify: /兑子取胜.*换车/,
  counterplay: /勉强求变/,
}

const transferTitleEvidence: Record<string, RegExp> = {
  material: /马换象先弃后取/, initiative: /子与势的关系/, 'worst-piece': /子力的位置/,
  'open-lines': /中路突破/, 'horse-quality': /退马失误/, 'cannon-position': /平炮有误/,
  'pawn-structure': /兑兵局/, 'king-safety': /马换双相破城池/, simplify: /车换马炮/,
  counterplay: /立足对攻/,
}

describe('middlegame evaluation course', () => {
  it('keeps concept and review exercises separate from lesson prose', () => {
    expect(Object.keys(middlegameExercises)).toEqual(middlegameLessons.map((lesson) => lesson.id))
    expect(Object.keys(middlegameReviewExercises)).toEqual(middlegameLessons.map((lesson) => lesson.id))
    expect(middlegameLessons.every((lesson) => lesson.quiz === middlegameExercises[lesson.id as keyof typeof middlegameExercises])).toBe(true)
    expect(middlegameLessons.every((lesson) => lesson.reviewPrompts === middlegameReviewExercises[lesson.id as keyof typeof middlegameReviewExercises])).toBe(true)
    expect(Object.values(middlegameExercises).flatMap((exercise) => exercise.choices).every((choice) => choice.feedback.length >= 55)).toBe(true)
    const reviewPrompts = Object.values(middlegameReviewExercises).flat()
    expect(reviewPrompts).toHaveLength(50)
    expect(new Set(reviewPrompts)).toHaveLength(50)
    expect(reviewPrompts.every((prompt) => prompt.length >= 55)).toBe(true)
  })

  it('keeps 10 sourced, detailed, legal five-ply lessons', () => {
    expect(middlegameLessons).toHaveLength(10)
    for (const lesson of middlegameLessons) {
      const example = middlegameExamples[lesson.id]
      expect(example).toBeTruthy()
      expect(example.title).toMatch(titleEvidence[lesson.id])
      expect(example.sourceName).toBe('Vietcotuong Community Database')
      expect(example.sourceUrl).toMatch(/^https:\/\/github\.com\/chasoft\/community-xiangqi-games-database\//)
      expect(example.moves).toHaveLength(5)
      expect(lesson.explanation).toHaveLength(3)
      expect(lesson.explanation.every((section) => section.body.length >= 70)).toBe(true)
      expect(lesson.pattern).toHaveLength(3)
      expect(lesson.steps).toHaveLength(5)
      expect(lesson.quiz.choices).toHaveLength(3)
      expect(lesson.quiz.choices.filter((choice) => choice.correct)).toHaveLength(1)

      let position = fromFEN(example.initialFen)
      for (const iccs of example.moves) {
        const move = moveFromICCS(iccs)
        expect(legalMoves(position)).toContainEqual(move)
        position = makeMove(position, move)
      }
    }
  })

  it('uses a distinct sourced and legal transfer position for every evaluation theme', () => {
    expect(Object.keys(middlegameTransferExamples)).toHaveLength(10)
    for (const lesson of middlegameLessons) {
      const example = middlegameTransferExamples[lesson.id]
      expect(example.id).not.toBe(middlegameExamples[lesson.id].id)
      expect(example.title).toMatch(transferTitleEvidence[lesson.id])
      expect(example.sourceName).toBe('Vietcotuong Community Database')
      expect(example.sourceUrl).toMatch(/^https:\/\/github\.com\/chasoft\/community-xiangqi-games-database\//)
      expect(example.moves).toHaveLength(5)
      expect(lesson.transferNote?.length).toBeGreaterThanOrEqual(45)
      expect(lesson.defenseNote?.length, `${lesson.id}: opponent resources`).toBeGreaterThanOrEqual(65)

      let position = fromFEN(example.initialFen)
      for (const iccs of example.moves) {
        const move = moveFromICCS(iccs)
        expect(legalMoves(position), `${lesson.id} transfer: ${iccs}`).toContainEqual(move)
        position = makeMove(position, move)
      }
    }
  })
})
