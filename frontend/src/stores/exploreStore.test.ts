import { describe, expect, it } from 'vitest'
import { START_FEN } from '../chess/fen'
import type { VariationTree } from './exploreStore'
import { appendLineToNode, resumeNodeId } from './exploreStore'

function sampleTree(currentNodeId?: string): VariationTree {
  return {
    rootFen: START_FEN,
    currentNodeId,
    root: {
      id: 'root',
      move: null,
      note: '',
      children: [
        {
          id: 'main-1',
          move: 'h2e2',
          note: '',
          children: [
            { id: 'main-2', move: 'h9g7', note: '', children: [] },
            { id: 'side-2', move: 'b9c7', note: '', children: [] },
          ],
        },
      ],
    },
  }
}

describe('explore store resume node', () => {
  it('resumes the saved current node when it still exists', () => {
    expect(resumeNodeId(sampleTree('side-2'))).toBe('side-2')
  })

  it('falls back to the mainline leaf for older trees without a saved current node', () => {
    expect(resumeNodeId(sampleTree())).toBe('main-2')
  })

  it('falls back to the mainline leaf when the saved current node was deleted', () => {
    expect(resumeNodeId(sampleTree('missing'))).toBe('main-2')
  })

  it('appends a continuation line under the selected node', () => {
    const tree = sampleTree('main-1')
    const result = appendLineToNode(tree, 'main-1', ['a0a1', 'a9a8'])

    expect(result?.changed).toBe(true)
    expect(tree.root.children[0].children).toHaveLength(3)
    expect(tree.root.children[0].children[2].move).toBe('a0a1')
    expect(tree.root.children[0].children[2].children[0].move).toBe('a9a8')
    expect(result?.currentNodeId).toBe(tree.root.children[0].children[2].children[0].id)
  })

  it('reuses existing continuation moves instead of duplicating them', () => {
    const tree = sampleTree('main-1')
    const result = appendLineToNode(tree, 'main-1', ['h9g7'])

    expect(result?.changed).toBe(false)
    expect(tree.root.children[0].children).toHaveLength(2)
    expect(result?.currentNodeId).toBe('main-2')
  })
})
