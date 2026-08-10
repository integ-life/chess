import { describe, expect, it } from 'vitest'
import { START_FEN, fromFEN, toFEN } from './fen'
import { gameStatus, inCheck, legalMoves } from './movegen'
import { makeMove } from './position'
import { moveFromICCS, moveToChinese, moveToICCS } from './notation'
import { sq } from './types'

function movesFrom(fen: string, iccsFrom: string): string[] {
  const pos = fromFEN(fen)
  const from = moveFromICCS(iccsFrom + iccsFrom).from
  return legalMoves(pos, from).map(moveToICCS)
}

describe('fen', () => {
  it('round-trips the start position', () => {
    expect(toFEN(fromFEN(START_FEN))).toBe(START_FEN)
  })
})

describe('piece rules', () => {
  it('horse leg blocking (蹩马腿)', () => {
    // 红马 b0，b1 有兵蹩腿 → 上跳 a2/c2 均被蹩，只能走 d1（黑将放 d9 避免白脸将）
    const fen = '3k5/9/9/9/9/9/9/9/1P7/1N2K4 w - - 0 1'
    expect(movesFrom(fen, 'b0').sort()).toEqual(['b0d1'])
  })

  it('elephant eye blocking (塞象眼)', () => {
    // 红相 c0，d1 被堵 → 只能走 a2
    const fen = '3k5/9/9/9/9/9/9/9/3P5/2B1K4 w - - 0 1'
    expect(movesFrom(fen, 'c0').sort()).toEqual(['c0a2'])
  })

  it('elephant cannot cross the river', () => {
    // 红相在 c4（河边）→ 不能过河到 a6/e6，只能退 a2/e2
    const fen = '3k5/9/9/9/9/2B6/9/9/9/4K4 w - - 0 1'
    expect(movesFrom(fen, 'c4').sort()).toEqual(['c4a2', 'c4e2'])
  })

  it('cannon needs exactly one screen to capture', () => {
    // 红炮 e2，e5 有炮架（黑卒），e9 黑将 → 可打 e9；e3/e4 是空位可走；不能吃 e5
    const fen = '4k4/9/9/9/4p4/9/9/4C4/9/4K4 w - - 0 1'
    const moves = movesFrom(fen, 'e2')
    expect(moves).toContain('e2e9') // 隔子打将
    expect(moves).toContain('e2e3')
    expect(moves).not.toContain('e2e5') // 不能直接吃炮架
    expect(moves).not.toContain('e2e6') // 炮架后的空位不能落
  })

  it('pawn moves forward only before river, plus sideways after', () => {
    // 黑将放 d9，避免兵离开 e 线时触发白脸将干扰用例
    const before = movesFrom('3k5/9/9/9/9/9/4P4/9/9/4K4 w - - 0 1', 'e3') // 未过河
    expect(before.sort()).toEqual(['e3e4'])
    const after = movesFrom('3k5/9/9/4P4/9/9/9/9/9/4K4 w - - 0 1', 'e6') // 已过河
    expect(after.sort()).toEqual(['e6d6', 'e6e7', 'e6f6'])
  })
})

describe('check rules', () => {
  it('flying general (白脸将) makes a move illegal', () => {
    // 红帅 e0、黑将 e9，中间只有红车 d0 可动 → 车不能离开… 改成：帅不能横移到对脸线
    // 红帅 d0，黑将 e9：帅走 e0 会白脸 → 非法
    const fen = '4k4/9/9/9/9/9/9/9/9/3K5 w - - 0 1'
    const moves = movesFrom(fen, 'd0')
    expect(moves).not.toContain('d0e0')
    expect(moves).toContain('d0d1')
  })

  it('detects check by cannon over a screen', () => {
    // 黑将 e9，红炮 e2，炮架 e5 → 黑被将军
    const fen = '4k4/9/9/9/4p4/9/9/4C4/9/4K4 b - - 0 1'
    expect(inCheck(fromFEN(fen), 'b')).toBe(true)
  })

  it('detects checkmate (将死)', () => {
    // 双车错：红车 a9 沿底线将军，红车 b8 控制第 8 横线 → 黑将无处可逃
    const mate = 'R3k4/1R7/9/9/9/9/9/9/9/4K4 b - - 0 1'
    const pos = fromFEN(mate)
    expect(inCheck(pos, 'b')).toBe(true)
    expect(gameStatus(pos)).toBe('checkmate')
  })

  it('detects stalemate (困毙) as a loss', () => {
    // 黑仅剩将在 d9，红车 e8 控制 d8 与 e9，黑未被将军但无着可走 → 困毙
    const fen = '3k5/4R4/9/9/9/9/9/9/9/4K4 b - - 0 1'
    const pos = fromFEN(fen)
    expect(inCheck(pos, 'b')).toBe(false)
    expect(gameStatus(pos)).toBe('stalemate')
  })
})

describe('notation', () => {
  const start = fromFEN(START_FEN)

  it('converts ICCS both ways', () => {
    const m = moveFromICCS('h2e2')
    expect(m).toEqual({ from: sq(7, 2), to: sq(4, 2) })
    expect(moveToICCS(m)).toBe('h2e2')
  })

  it('renders 炮二平五', () => {
    expect(moveToChinese(start, moveFromICCS('h2e2'))).toBe('炮二平五')
  })

  it('renders 馬八进七 for red horse b0c2', () => {
    expect(moveToChinese(start, moveFromICCS('b0c2'))).toBe('馬八进七')
  })

  it('renders black moves with arabic numerals', () => {
    const afterRed = makeMove(start, moveFromICCS('h2e2'))
    // 黑炮 b7（黑方 2 路）平中：b7e7 → 砲2平5
    expect(moveToChinese(afterRed, moveFromICCS('b7e7'))).toBe('砲2平5')
  })

  it('disambiguates 前/后 for tandem rooks', () => {
    // 红双车同在 a 线（a0、a4），前车（a4 更靠近黑方）平移
    const fen = '4k4/9/9/9/9/R8/9/9/9/R3K4 w - - 0 1'
    const pos = fromFEN(fen)
    expect(moveToChinese(pos, moveFromICCS('a4e4'))).toBe('前車平五')
    expect(moveToChinese(pos, moveFromICCS('a0a1'))).toBe('后車进一')
  })
})
