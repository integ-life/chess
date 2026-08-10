import { describe, expect, it } from 'vitest'
import { START_FEN, fromFEN } from '../chess/fen'
import { moveFromICCS } from '../chess/notation'
import { isLegal, makeMove } from '../chess/position'
import { explainOpeningAlternative, firstBranchIndex, openingLessons, teachingAlternatives } from './course'
import { openingDeepDives } from './deepDive'
import { openingExercises } from './exercises'
import { courseExamples } from './examples'

describe('opening course', () => {
  it('stores all 36 immediate and 60 review exercises separately with detailed feedback and valid checkpoints', () => {
    expect(Object.keys(openingExercises)).toEqual(openingLessons.map((lesson) => lesson.id))
    const choices = Object.values(openingExercises).flatMap((exercise) => exercise.quiz.choices)
    const reviewPrompts = Object.values(openingExercises).flatMap((exercise) => exercise.reviewPrompts)
    expect(choices).toHaveLength(36)
    expect(choices.every((choice) => choice.feedback.length >= 65)).toBe(true)
    expect(reviewPrompts).toHaveLength(60)
    expect(new Set(reviewPrompts).size).toBe(reviewPrompts.length)
    expect(reviewPrompts.every((prompt) => prompt.length >= 55)).toBe(true)
    for (const lesson of openingLessons) {
      const exercise = openingExercises[lesson.id]
      expect(lesson.quiz).toBe(exercise.quiz)
      expect(exercise.reviewPrompts).toHaveLength(5)
      expect(exercise.checkpoints).toHaveLength(2)
      expect(new Set(exercise.checkpoints).size).toBe(2)
      expect(exercise.checkpoints.every((checkpoint) => checkpoint >= 0 && checkpoint < lesson.steps.length)).toBe(true)
      expect(new Set(exercise.checkpoints.map((checkpoint) => checkpoint % 2)).size).toBe(2)
    }
  })

  it('contains twelve legal lessons with one answer each', () => {
    expect(openingLessons).toHaveLength(12)
    expect(openingLessons.flatMap((lesson) => lesson.steps)).toHaveLength(114)
    let alternativeExplanationCount = 0
    for (const lesson of openingLessons) {
      expect(lesson.explanation.length, `${lesson.id}: explanation`).toBeGreaterThanOrEqual(2)
      expect(lesson.concepts.length, `${lesson.id}: concepts`).toBeGreaterThanOrEqual(4)
      expect(lesson.checklist.length, `${lesson.id}: checklist`).toBeGreaterThanOrEqual(3)
      expect(lesson.transitionChecks, `${lesson.id}: transition checks`).toHaveLength(3)
      expect(lesson.explanation.every((paragraph) => paragraph.length >= 45), `${lesson.id}: paragraph detail`).toBe(true)
      expect(lesson.concepts.every((concept) => concept.definition.length >= 25), `${lesson.id}: concept detail`).toBe(true)
      expect(lesson.transitionChecks.every((check) => check.length >= 35), `${lesson.id}: transition detail`).toBe(true)
      expect(openingDeepDives[lesson.id], `${lesson.id}: deep dive`).toHaveLength(3)
      expect(openingDeepDives[lesson.id].every((section) => section.body.length >= 90), `${lesson.id}: deep detail`).toBe(true)
      expect(lesson.steps.every((step) => step.note.length >= 25), `${lesson.id}: move explanation`).toBe(true)
      let position = fromFEN(START_FEN)
      for (const step of lesson.steps) {
        const move = moveFromICCS(step.move)
        expect(isLegal(position, move), `${lesson.id}: ${step.move}`).toBe(true)
        const alternatives = teachingAlternatives(position, move)
        expect(alternatives, `${lesson.id}: alternatives for ${step.move}`).toHaveLength(2)
        expect(alternatives.every((alternative) => isLegal(position, alternative))).toBe(true)
        const explanations = alternatives.map((alternative) => explainOpeningAlternative(position, alternative, move))
        expect(explanations.every((explanation) => explanation.length >= 60), `${lesson.id}: alternative detail`).toBe(true)
        expect(new Set(explanations).size, `${lesson.id}: distinct alternatives`).toBe(explanations.length)
        alternativeExplanationCount += explanations.length
        position = makeMove(position, move)
      }
      expect(lesson.quiz.choices.filter((choice) => choice.correct)).toHaveLength(1)
    }
    expect(alternativeExplanationCount).toBe(228)
  })

  it('provides one sourced, legal canonical game for every lesson', () => {
    expect(Object.keys(courseExamples)).toHaveLength(openingLessons.length)
    let realDeviations = 0
    for (const lesson of openingLessons) {
      const example = courseExamples[lesson.id]
      expect(example, `${lesson.id}: example`).toBeDefined()
      expect(example.opening, `${lesson.id}: opening`).not.toBe('')
      expect(example.redPlayer, `${lesson.id}: red player`).not.toBe('')
      expect(example.blackPlayer, `${lesson.id}: black player`).not.toBe('')
      expect(example.sourceName, `${lesson.id}: source`).not.toBe('')
      expect(example.sourceUrl, `${lesson.id}: source url`).toMatch(/^https:\/\//)
      expect(example.moves.length, `${lesson.id}: complete game`).toBeGreaterThanOrEqual(40)
      const branch = firstBranchIndex(lesson.steps.map((step) => step.move), example.moves)
      expect(branch, `${lesson.id}: real model-game branch`).toBeGreaterThanOrEqual(0)
      expect(branch, `${lesson.id}: branch or continuation`).toBeLessThanOrEqual(lesson.steps.length)
      if (branch < lesson.steps.length) realDeviations++

      let position = fromFEN(example.initialFen)
      for (const moveText of example.moves) {
        const move = moveFromICCS(moveText)
        expect(isLegal(position, move), `${lesson.id}: model game ${moveText}`).toBe(true)
        position = makeMove(position, move)
      }
    }
    expect(realDeviations).toBeGreaterThanOrEqual(6)
  })
})
