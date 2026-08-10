import type { Move, Position } from './types'
import { applyMove, legalMoves } from './movegen'
export const makeMove = applyMove
export function isLegal(pos: Position, m: Move): boolean { return legalMoves(pos, m.from).some((x) => x.to === m.to && (x.promotion ?? 'a') === (m.promotion ?? 'a')) }
