import { describe, expect, it } from 'vitest'
import { fromFEN } from '../chess/fen'
import { legalMoves } from '../chess/movegen'
import { moveFromICCS } from '../chess/notation'
import { makeMove } from '../chess/position'
import { endgameExercises, endgameReviewExercises } from './exercises/endgames'
import { endgameExamples, endgameLessons, endgameTransferExamples } from './endgames'

const titleEvidence: Record<string, RegExp> = {
  'king-activity': /亮帅助攻/,
  'pawn-value': /单兵巧和/,
  waiting: /等着|闲着/,
  fortress: /和/,
  'pawn-defense': /兵和士象/,
  'two-pawns': /双兵巧胜/,
  horse: /单马和/,
  cannon: /双炮例和单炮/,
  rook: /单车例胜/,
  'rook-pawn': /车兵残局/,
  'mixed-rook': /车马巧胜车炮/,
  'cannon-pawn': /炮高兵/,
  'horse-pawn': /马兵残局/,
  'many-pawns': /三兵例胜/,
  exchange: /兑子引离/,
  defense: /守和单车/,
}

const transferTitleEvidence: Record<string, RegExp> = {
  'king-activity': /亮帅助攻/,
  'pawn-value': /单兵和单炮/,
  waiting: /等着/,
  fortress: /炮双仕和单车/,
  'pawn-defense': /高兵单仕和炮士象全/,
  'two-pawns': /双兵巧胜士象全/,
  horse: /单马和双卒/,
  cannon: /双炮巧胜单炮/,
  rook: /单车必胜双象/,
  'rook-pawn': /车高兵和车士/,
  'mixed-rook': /车马相巧胜车炮士/,
  'cannon-pawn': /炮高兵巧胜双象/,
  'horse-pawn': /马低兵胜马高将/,
  'many-pawns': /三兵例胜马双象/,
  exchange: /兑子取势.*多卒占优/,
  defense: /马双象守和单车/,
}

describe('practical endgame course', () => {
  it('keeps concept and review exercises separate from lesson prose', () => {
    expect(Object.keys(endgameExercises)).toEqual(endgameLessons.map((lesson) => lesson.id))
    expect(Object.keys(endgameReviewExercises)).toEqual(endgameLessons.map((lesson) => lesson.id))
    expect(endgameLessons.every((lesson) => lesson.quiz === endgameExercises[lesson.id as keyof typeof endgameExercises])).toBe(true)
    expect(endgameLessons.every((lesson) => lesson.reviewPrompts === endgameReviewExercises[lesson.id as keyof typeof endgameReviewExercises])).toBe(true)
    expect(Object.values(endgameExercises).flatMap((exercise) => exercise.choices).every((choice) => choice.feedback.length >= 55)).toBe(true)
    const reviewPrompts = Object.values(endgameReviewExercises).flat()
    expect(reviewPrompts).toHaveLength(80)
    expect(new Set(reviewPrompts)).toHaveLength(80)
    expect(reviewPrompts.every((prompt) => prompt.length >= 55)).toBe(true)
  })

  it('keeps 16 sourced, detailed, legal five-ply lessons', () => {
    expect(endgameLessons).toHaveLength(16)
    for (const lesson of endgameLessons) {
      const example = endgameExamples[lesson.id]
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

  it('keeps 16 distinct sourced and legal transfer positions', () => {
    const primaryIds = new Set(Object.values(endgameExamples).map((example) => example.id))
    const transferIds = new Set<string>()

    for (const lesson of endgameLessons) {
      const example = endgameTransferExamples[lesson.id]
      expect(example).toBeTruthy()
      expect(example.title).toMatch(transferTitleEvidence[lesson.id])
      expect(example.sourceName).toBe('Vietcotuong Community Database')
      expect(example.sourceUrl).toMatch(/^https:\/\/github\.com\/chasoft\/community-xiangqi-games-database\//)
      expect(example.moves).toHaveLength(5)
      expect(primaryIds.has(example.id)).toBe(false)
      expect(transferIds.has(example.id)).toBe(false)
      expect(lesson.transferNote?.length).toBeGreaterThanOrEqual(70)
      expect(lesson.defenseNote?.length, `${lesson.id}: defensive resources`).toBeGreaterThanOrEqual(65)
      transferIds.add(example.id)

      let position = fromFEN(example.initialFen)
      for (const iccs of example.moves) {
        const move = moveFromICCS(iccs)
        expect(legalMoves(position)).toContainEqual(move)
        position = makeMove(position, move)
      }
    }

    expect(transferIds.size).toBe(16)
  })
})
