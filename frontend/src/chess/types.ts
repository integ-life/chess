export type Color = 'r' | 'b'

// 保留项目原有的短代码，减少上层数据迁移成本：a=后、e=象、h=马。
export type PieceType = 'k' | 'a' | 'e' | 'h' | 'r' | 'p' | 'c'

export interface Piece { color: Color; type: PieceType }
export type Square = number
export interface Move { from: Square; to: Square; promotion?: 'a' | 'r' | 'e' | 'h' }
export interface Position {
  board: (Piece | null)[]
  turn: Color
  castling?: string
  enPassant?: Square | null
  halfmove?: number
  fullmove?: number
}

export const FILES = 8
export const RANKS = 8
export const sq = (file: number, rank: number): Square => rank * FILES + file
export const fileOf = (s: Square): number => s % FILES
export const rankOf = (s: Square): number => Math.floor(s / FILES)
export const opposite = (c: Color): Color => c === 'r' ? 'b' : 'r'
export const onBoard = (file: number, rank: number): boolean => file >= 0 && file < 8 && rank >= 0 && rank < 8
