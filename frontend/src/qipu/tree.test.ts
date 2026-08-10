import { describe, expect, it } from 'vitest'
import { START_FEN } from '../chess/fen'
import { lineToVariationTree, mainlineMovesFromTree } from './tree'

describe('variation tree helpers', () => {
  it('converts a linear game into a variation tree and keeps the mainline summary', () => {
    const moves = ['h2e2', 'h9g7', 'h0g2']
    const tree = lineToVariationTree(moves, START_FEN, { nodeIdPrefix: 'game:test' })

    expect(tree.rootFen).toBe(START_FEN)
    expect(tree.root.children[0].move).toBe('h2e2')
    expect(tree.root.children[0].children[0].move).toBe('h9g7')
    expect(mainlineMovesFromTree(tree)).toEqual(moves)
  })
})
