import type { Piece, PieceType, Position } from './types'
import { FILES, RANKS, sq } from './types'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const FEN_TO_TYPE: Record<string, PieceType> = { k: 'k', q: 'a', b: 'e', n: 'h', r: 'r', p: 'p', c: 'c' }
const TYPE_TO_FEN: Record<PieceType, string> = { k: 'k', a: 'q', e: 'b', h: 'n', r: 'r', p: 'p', c: 'q' }

export function fromFEN(fen: string): Position {
  const parts = fen.trim().split(/\s+/)
  const rows = parts[0]?.split('/') ?? []
  if (rows.length !== RANKS) throw new Error(`invalid FEN: ${fen}`)
  const board: (Piece | null)[] = new Array(FILES * RANKS).fill(null)
  rows.forEach((row, i) => {
    let file = 0
    for (const ch of row) {
      if (/\d/.test(ch)) file += Number(ch)
      else {
        const type = FEN_TO_TYPE[ch.toLowerCase()]
        if (!type || file >= 8) throw new Error(`invalid FEN: ${fen}`)
        board[sq(file++, 7 - i)] = { color: ch === ch.toUpperCase() ? 'r' : 'b', type }
      }
    }
    if (file !== 8) throw new Error(`invalid FEN rank: ${row}`)
  })
  const ep = parts[3] && parts[3] !== '-' ? sq(parts[3].charCodeAt(0) - 97, Number(parts[3][1]) - 1) : null
  return { board, turn: parts[1] === 'b' ? 'b' : 'r', castling: parts[2] === '-' ? '' : (parts[2] ?? ''), enPassant: ep, halfmove: Number(parts[4] ?? 0), fullmove: Number(parts[5] ?? 1) }
}

export function toFEN(pos: Position): string {
  const rows: string[] = []
  for (let rank = 7; rank >= 0; rank--) {
    let row = '', empty = 0
    for (let file = 0; file < 8; file++) {
      const p = pos.board[sq(file, rank)]
      if (!p) { empty++; continue }
      if (empty) { row += empty; empty = 0 }
      const ch = TYPE_TO_FEN[p.type]
      row += p.color === 'r' ? ch.toUpperCase() : ch
    }
    rows.push(row + (empty || ''))
  }
  const ep = pos.enPassant == null ? '-' : String.fromCharCode(97 + pos.enPassant % 8) + (Math.floor(pos.enPassant / 8) + 1)
  return `${rows.join('/')} ${pos.turn === 'r' ? 'w' : 'b'} ${pos.castling || '-'} ${ep} ${pos.halfmove ?? 0} ${pos.fullmove ?? 1}`
}
