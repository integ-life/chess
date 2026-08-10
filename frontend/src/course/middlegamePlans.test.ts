import { describe, expect, it } from 'vitest'
import { fromFEN } from '../chess/fen'
import { legalMoves } from '../chess/movegen'
import { moveFromICCS } from '../chess/notation'
import { makeMove } from '../chess/position'
import { middlegamePlanExercises, middlegamePlanReviewExercises } from './exercises/middlegamePlans'
import { middlegamePlanExamples, middlegamePlanLessons, middlegamePlanTransferExamples } from './middlegamePlans'

const titleEvidence: Record<string, RegExp> = {
  concentrate: /集中火力/,
  'open-lines': /进兵开路/,
  sacrifice: /弃子攻杀/,
  reinforce: /后备增援/,
  'exchange-attacker': /兑子解围/,
  counter: /解杀还杀/,
  'switch-wings': /声东击西/,
  'position-to-tactics': /冲兵取势.*打双/,
  'favorable-endgame': /兑子取势.*优胜残局/,
  'master-case': /吕钦.*稳守反击/,
}

const transferTitleEvidence: Record<string, RegExp> = {
  concentrate: /集中兵力.*联攻巧胜/, 'open-lines': /弃炮开路.*边车偷袭/,
  sacrifice: /弃子攻杀/, reinforce: /落士防守.*攻守兼备/,
  'exchange-attacker': /兑子解围/, counter: /解杀还杀/,
  'switch-wings': /声东击西.*谋子成功/, 'position-to-tactics': /冲兵不怕炮打双/,
  'favorable-endgame': /兑子简化.*妙用炮卒/, 'master-case': /许银川和吕钦.*吕评/,
}

describe('middlegame plans course', () => {
  it('keeps concept and review exercises separate from lesson prose', () => {
    expect(Object.keys(middlegamePlanExercises)).toEqual(middlegamePlanLessons.map((lesson) => lesson.id))
    expect(Object.keys(middlegamePlanReviewExercises)).toEqual(middlegamePlanLessons.map((lesson) => lesson.id))
    expect(middlegamePlanLessons.every((lesson) => lesson.quiz === middlegamePlanExercises[lesson.id as keyof typeof middlegamePlanExercises])).toBe(true)
    expect(middlegamePlanLessons.every((lesson) => lesson.reviewPrompts === middlegamePlanReviewExercises[lesson.id as keyof typeof middlegamePlanReviewExercises])).toBe(true)
    expect(Object.values(middlegamePlanExercises).flatMap((exercise) => exercise.choices).every((choice) => choice.feedback.length >= 55)).toBe(true)
    const reviewPrompts = Object.values(middlegamePlanReviewExercises).flat()
    expect(reviewPrompts).toHaveLength(50)
    expect(new Set(reviewPrompts)).toHaveLength(50)
    expect(reviewPrompts.every((prompt) => prompt.length >= 55)).toBe(true)
  })

  it('keeps 10 sourced, detailed, legal five-ply lessons', () => {
    expect(middlegamePlanLessons).toHaveLength(10)
    for (const lesson of middlegamePlanLessons) {
      const example = middlegamePlanExamples[lesson.id]
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

  it('uses a distinct sourced and legal transfer position for every plan', () => {
    expect(Object.keys(middlegamePlanTransferExamples)).toHaveLength(10)
    for (const lesson of middlegamePlanLessons) {
      const example = middlegamePlanTransferExamples[lesson.id]
      expect(example.id).not.toBe(middlegamePlanExamples[lesson.id].id)
      expect(example.title).toMatch(transferTitleEvidence[lesson.id])
      expect(example.sourceName).toBe('Vietcotuong Community Database')
      expect(example.sourceUrl).toMatch(/^https:\/\/github\.com\/chasoft\/community-xiangqi-games-database\//)
      expect(example.moves).toHaveLength(5)
      expect(lesson.transferNote?.length).toBeGreaterThanOrEqual(45)
      expect(lesson.defenseNote?.length, `${lesson.id}: plan disruption`).toBeGreaterThanOrEqual(65)

      let position = fromFEN(example.initialFen)
      for (const iccs of example.moves) {
        const move = moveFromICCS(iccs)
        expect(legalMoves(position), `${lesson.id} transfer: ${iccs}`).toContainEqual(move)
        position = makeMove(position, move)
      }
    }
  })
})
