import { describe, expect, it } from 'vitest'
import { curriculumStages, totalCurriculumLessons } from './curriculum'
import { foundationLessons } from './foundation'
import { foundationExercises } from './exercises/foundation'
import { mateReviewExercises } from './exercises/mates'
import { tacticReviewExercises } from './exercises/tactics'
import { middlegameReviewExercises } from './exercises/middlegame'
import { middlegamePlanReviewExercises } from './exercises/middlegamePlans'
import { endgameReviewExercises } from './exercises/endgames'
import { practiceReviewExercises } from './exercises/practice'
import { mateExamples, mateLessons, mateTransferExamples } from './mates'
import { tacticExamples, tacticLessons, tacticTransferExamples } from './tactics'
import { openingLessons } from '../opening/course'
import { openingExercises } from '../opening/exercises'
import { courseExamples } from '../opening/examples'
import { middlegameExamples, middlegameLessons, middlegameTransferExamples } from './middlegame'
import { middlegamePlanExamples, middlegamePlanLessons, middlegamePlanTransferExamples } from './middlegamePlans'
import { endgameExamples, endgameLessons, endgameTransferExamples } from './endgames'
import { practiceExamples, practiceLessons } from './practice'
import { START_FEN, fromFEN } from '../chess/fen'
import { moveFromICCS } from '../chess/notation'
import { makeMove } from '../chess/position'
import { courseMoveOptions, describeCourseMove } from './pattern'
import type { CourseLineExample, PatternLesson } from './pattern'

describe('curriculum', () => {
  it('covers the complete learning path', () => {
    expect(curriculumStages.map((stage) => stage.id)).toEqual(['foundation', 'mates', 'tactics', 'opening', 'middlegame-evaluation', 'middlegame-plans', 'endgames', 'practice'])
    expect(totalCurriculumLessons).toBeGreaterThanOrEqual(70)
    expect(curriculumStages.every((stage) => stage.lessons.length >= 8 && stage.outcome.length >= 20)).toBe(true)
    expect(curriculumStages.every((stage) => stage.path)).toBe(true)
  })

  it('keeps the outline synchronized with all 86 shipped lessons', () => {
    const shipped = [foundationLessons, mateLessons, tacticLessons, openingLessons, middlegameLessons, middlegamePlanLessons, endgameLessons, practiceLessons]
    expect(totalCurriculumLessons).toBe(86)
    curriculumStages.forEach((stage, index) => expect(stage.lessons, stage.id).toEqual(shipped[index].map((lesson) => lesson.title)))
  })

  it('stores five unique review exercises for every shipped lesson', () => {
    const lessonPrompts = [
      ...Object.values(foundationExercises).map((exercise) => exercise.reviewPrompts),
      ...Object.values(mateReviewExercises),
      ...Object.values(tacticReviewExercises),
      ...Object.values(openingExercises).map((exercise) => exercise.reviewPrompts),
      ...Object.values(middlegameReviewExercises),
      ...Object.values(middlegamePlanReviewExercises),
      ...Object.values(endgameReviewExercises),
      ...Object.values(practiceReviewExercises),
    ]
    const prompts = lessonPrompts.flat()
    expect(lessonPrompts).toHaveLength(86)
    expect(lessonPrompts.every((items) => items.length === 5)).toBe(true)
    expect(prompts).toHaveLength(430)
    expect(new Set(prompts).size).toBe(430)
    expect(prompts.every((prompt) => prompt.length >= 55)).toBe(true)
  })

  it('ships eight detailed foundation lessons', () => {
    expect(foundationLessons).toHaveLength(8)
    expect(Object.keys(foundationExercises)).toEqual(foundationLessons.map((lesson) => lesson.id))
    const reviewPrompts = Object.values(foundationExercises).flatMap((exercise) => exercise.reviewPrompts)
    expect(reviewPrompts).toHaveLength(40)
    expect(new Set(reviewPrompts).size).toBe(reviewPrompts.length)
    expect(reviewPrompts.every((prompt) => prompt.length >= 55)).toBe(true)
    for (const lesson of foundationLessons) {
      const exercise = foundationExercises[lesson.id as keyof typeof foundationExercises]
      expect(lesson.sections.length).toBeGreaterThanOrEqual(3)
      expect(lesson.sections.every((section) => section.body.length >= 75), `${lesson.id}: detail`).toBe(true)
      expect(lesson.keyPoints.length).toBeGreaterThanOrEqual(3)
      expect(lesson.practicePrompt).toBe(exercise.practicePrompt)
      expect(lesson.practicePrompt.length, `${lesson.id}: practice`).toBeGreaterThanOrEqual(35)
      expect(lesson.reviewPrompts).toBe(exercise.reviewPrompts)
      expect(lesson.reviewPrompts).toHaveLength(5)
      expect(lesson.ruling).toBe(exercise.ruling)
      expect(lesson.ruling.prompt.length, `${lesson.id}: ruling prompt`).toBeGreaterThanOrEqual(35)
      expect(lesson.ruling.answer.length, `${lesson.id}: ruling answer`).toBeGreaterThanOrEqual(55)
      expect(() => fromFEN(lesson.practiceFen ?? START_FEN), `${lesson.id}: practice fen`).not.toThrow()
      expect(lesson.quiz).toBe(exercise.quiz)
      expect(lesson.quiz.choices.filter((choice) => choice.correct)).toHaveLength(1)
      expect(lesson.quiz.choices.every((choice) => choice.feedback.length >= 55), `${lesson.id}: quiz feedback`).toBe(true)
    }
    const repetitionLesson = foundationLessons.find((lesson) => lesson.id === 'legal-game')!
    const repetitionText = repetitionLesson.sections.map((section) => `${section.title}${section.body}`).join('')
    expect(repetitionLesson.sections).toHaveLength(5)
    expect(repetitionText).toMatch(/长将.*长捉|长捉.*长将/)
    expect(repetitionText).toContain('采用的规则')
    expect(repetitionText).toContain('不自动裁决重复、长将或长捉')
  })

  it('explains every sourced pattern-course quiz choice', () => {
    expect([mateLessons, tacticLessons, openingLessons, middlegameLessons, middlegamePlanLessons, endgameLessons, practiceLessons].flat().flatMap((lesson) => lesson.quiz.choices).every((choice) => choice.feedback.length >= 30)).toBe(true)
  })

  it('keeps every course game traceable to a canonical identity and source', () => {
    const examples = [mateExamples, mateTransferExamples, tacticExamples, tacticTransferExamples, courseExamples, middlegameExamples, middlegameTransferExamples, middlegamePlanExamples, middlegamePlanTransferExamples, endgameExamples, endgameTransferExamples, practiceExamples].flatMap(Object.values)
    expect(examples).toHaveLength(134)
    expect(examples.every((example) => /^[0-9a-f]{64}$/.test(example.id))).toBe(true)
    expect(examples.every((example) => example.sourceName && /^https:\/\//.test(example.sourceUrl))).toBe(true)
  })

  it('does not repeat teaching points inside a lesson', () => {
    for (const lesson of foundationLessons) {
      expect(new Set(lesson.sections.map((section) => section.title)).size, lesson.id).toBe(lesson.sections.length)
      expect(new Set(lesson.keyPoints).size, lesson.id).toBe(lesson.keyPoints.length)
    }
    for (const lesson of openingLessons) {
      expect(new Set(lesson.concepts.map((concept) => concept.term)).size, lesson.id).toBe(lesson.concepts.length)
      expect(new Set(lesson.checklist).size, lesson.id).toBe(lesson.checklist.length)
      expect(new Set(lesson.steps.map((step) => step.note)).size, lesson.id).toBe(lesson.steps.length)
    }
    for (const lesson of [mateLessons, tacticLessons, middlegameLessons, middlegamePlanLessons, endgameLessons, practiceLessons].flat()) {
      expect(new Set(lesson.explanation.map((section) => section.title)).size, lesson.id).toBe(lesson.explanation.length)
      expect(new Set(lesson.pattern).size, lesson.id).toBe(lesson.pattern.length)
      expect(lesson.steps.every((step) => step.purpose.length >= 18), `${lesson.id}: step purpose`).toBe(true)
      expect(lesson.steps.every((step) => step.alternative.length >= 18), `${lesson.id}: step alternative`).toBe(true)
    }
  })

  it('explains the actual move behind every pattern-course alternative', () => {
    const groups: { lessons: PatternLesson[]; examples: Record<string, CourseLineExample>; transfers?: Record<string, CourseLineExample> }[] = [
      { lessons: mateLessons, examples: mateExamples, transfers: mateTransferExamples },
      { lessons: tacticLessons, examples: tacticExamples, transfers: tacticTransferExamples },
      { lessons: middlegameLessons, examples: middlegameExamples, transfers: middlegameTransferExamples },
      { lessons: middlegamePlanLessons, examples: middlegamePlanExamples, transfers: middlegamePlanTransferExamples },
      { lessons: endgameLessons, examples: endgameExamples, transfers: endgameTransferExamples },
      { lessons: practiceLessons, examples: practiceExamples },
    ]
    let mainPositions = 0
    let transferPositions = 0
    let alternativeExplanations = 0

    for (const group of groups) {
      for (const [lessonIndex, lesson] of group.lessons.entries()) {
        const example = group.examples[lesson.id]
        let position = fromFEN(example.initialFen)
        for (const [stepIndex, moveText] of example.moves.entries()) {
          const mainMove = moveFromICCS(moveText)
          const alternatives = courseMoveOptions(position, mainMove, lessonIndex + stepIndex)
            .filter((move) => move.from !== mainMove.from || move.to !== mainMove.to)
          const explanations = alternatives.map((move) => describeCourseMove(position, move))
          expect(explanations.every((explanation) => explanation.length >= 35), `${lesson.id}: move detail`).toBe(true)
          expect(new Set(explanations).size, `${lesson.id}: distinct move detail`).toBe(explanations.length)
          alternativeExplanations += explanations.length
          mainPositions++
          position = makeMove(position, mainMove)
        }

        if (group.transfers) {
          const transfer = group.transfers[lesson.id]
          const position = fromFEN(transfer.initialFen)
          const mainMove = moveFromICCS(transfer.moves[0])
          const alternatives = courseMoveOptions(position, mainMove, lessonIndex + 17)
            .filter((move) => move.from !== mainMove.from || move.to !== mainMove.to)
          const explanations = alternatives.map((move) => describeCourseMove(position, move))
          expect(explanations.every((explanation) => explanation.length >= 35), `${lesson.id}: transfer move detail`).toBe(true)
          expect(new Set(explanations).size, `${lesson.id}: distinct transfer detail`).toBe(explanations.length)
          alternativeExplanations += explanations.length
          transferPositions++
        }
      }
    }

    expect(mainPositions).toBe(330)
    expect(transferPositions).toBe(56)
    expect(alternativeExplanations).toBe(703)
  })
})
