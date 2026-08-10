import { describe, expect, it } from 'vitest'
import { fromFEN } from '../chess/fen'
import { moveFromICCS } from '../chess/notation'
import { isLegal, makeMove } from '../chess/position'
import practiceExamplesData from '../course/practice-examples.json'
import type { CourseLineExample } from '../course/pattern'
import { courseExampleQipuRecords } from '../opening/examples'
import { catalogQipuRecords } from './catalog'
import { qipuToVariationTree } from './format'
import { getPublicQipu, learningQipuRecords, publicQipuRecords } from './publicQipu'

const practiceExamples = practiceExamplesData as Record<string, CourseLineExample>

describe('qipu format', () => {
  it('converts public qipu records into variation trees with notes', () => {
    expect(new Set(publicQipuRecords.map((qipu) => qipu.id)).size).toBe(publicQipuRecords.length)
    expect(publicQipuRecords.some((qipu) => /^(practice|course-example)-/.test(qipu.id))).toBe(false)
    for (const qipu of publicQipuRecords) {
      const tree = qipuToVariationTree(qipu)

      expect(tree.root.note).toBeTruthy()
      expect(tree.root.children.length).toBeGreaterThan(0)
      expect(tree.currentNodeId).toBe(tree.root.id)
    }
    expect(learningQipuRecords.every((qipu) => qipu.line[0]?.note)).toBe(true)
  })

  it('keeps complete course games when canonical records overlap', () => {
    for (const qipu of courseExampleQipuRecords) {
      expect(getPublicQipu(qipu.id)?.line).toEqual(qipu.line)
    }
    for (const example of Object.values(practiceExamples)) {
      expect(getPublicQipu(`canonical-${example.id}`)?.line).toHaveLength((example.fullMoves ?? example.moves).length)
    }
  })

  it('replays every representative canonical game legally', () => {
    expect(catalogQipuRecords).toHaveLength(48)
    for (const qipu of catalogQipuRecords) {
      let position = fromFEN(qipu.rootFen!)
      for (const entry of qipu.line) {
        const move = moveFromICCS(entry.move)
        expect(isLegal(position, move), `${qipu.id}: ${entry.move}`).toBe(true)
        position = makeMove(position, move)
      }
    }
  })

  it('imports variations as sibling branches from the same position', () => {
    const tree = qipuToVariationTree(publicQipuRecords[0])

    expect(tree.root.children.map((node) => node.move)).toEqual(['h2e2'])
    expect(tree.root.children[0].children.map((node) => node.move)).toEqual(['h9g7', 'b9c7'])
    expect(tree.root.children[0].children[1].note).toContain('左马')
  })

  it('rejects moves whose source square has no piece', () => {
    expect(() =>
      qipuToVariationTree({
        format: 'xiangqi-study-v1',
        id: 'bad',
        title: 'bad',
        summary: 'bad',
        tags: [],
        line: [{ move: 'e4e5' }],
      }),
    ).toThrow('起点没有棋子')
  })
})
