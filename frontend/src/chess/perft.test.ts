import { describe, expect, it } from 'vitest'
import fixtures from '../../../shared/perft-fixtures.json'
import { fromFEN } from './fen'
import { perft } from './movegen'

// depth 5（1.3 亿节点）太慢，只在 Go 侧手动跑
const MAX_DEPTH = 4

describe('perft', () => {
  for (const fx of fixtures.fixtures) {
    for (const [depth, expected] of Object.entries(fx.perft)) {
      if (Number(depth) > MAX_DEPTH) continue
      it(`${fx.name} depth ${depth} = ${expected}`, () => {
        expect(perft(fromFEN(fx.fen), Number(depth))).toBe(expected)
      })
    }
  }
})
