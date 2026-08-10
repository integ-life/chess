import { legalMoves } from '../chess/movegen'
import type { Move, PieceType, Position } from '../chess/types'

export interface CourseLineExample {
  id: string
  title: string
  result: string
  initialFen: string
  moves: string[]
  fullMoves?: string[]
  sourceName: string
  sourceUrl: string
}

export interface PatternLesson {
  id: string
  title: string
  summary: string
  transferNote?: string
  defenseNote?: string
  deliverable?: string[]
  reviewPrompts: string[]
  explanation: { title: string; body: string }[]
  pattern: string[]
  steps: { purpose: string; alternative: string }[]
  quiz: { prompt: string; choices: { text: string; correct?: boolean; feedback: string }[] }
}

const pieceNames: Record<PieceType, string> = { h: '马', c: '炮', r: '车', p: '兵卒', e: '象', a: '士', k: '将帅' }
const squareName = (square: number) => `${String.fromCharCode(97 + square % 9)}${Math.floor(square / 9)}`
const boardArea = (square: number) => square % 9 < 3 ? '棋盘左翼' : square % 9 > 5 ? '棋盘右翼' : '中路'
const moveKey = (move: Move) => `${move.from}-${move.to}`

export const coursePieceName = (piece: PieceType) => pieceNames[piece]

export function describeCourseMove(position: Position, move: Move): string {
  const piece = position.board[move.from]
  if (!piece) return '这步改变当前走序，但起点没有可说明的棋子'
  const target = position.board[move.to]
  const action = {
    h: '改变近处控制点，并重新安排下一跳',
    c: '改变炮线与可利用的炮架',
    r: '把重子活动转到新的线路',
    p: '改变空间和相邻马路',
    e: '调整中路防守与两翼联络',
    a: '加固将区并改变宫内保护点',
    k: '调整将帅安全点与照面关系',
  }[piece.type]
  const clearsRook = (piece.type === 'h' || piece.type === 'c') && [1, 7].includes(move.from % 9) && Math.floor(move.from / 9) === (piece.color === 'r' ? 0 : 9)
  return `${pieceNames[piece.type]}从 ICCS ${squareName(move.from)} 走到 ${squareName(move.to)}（${boardArea(move.to)}），${action}${clearsRook ? '，同时让同侧边车获得出路' : ''}${target ? `，并吃掉一枚${pieceNames[target.type]}` : ''}；走完后还要检查己方将帅安全和对手最强回应`
}

export function courseMoveOptions(position: Position, mainMove: Move, seed: number): Move[] {
  const alternatives = legalMoves(position)
    .filter((move) => moveKey(move) !== moveKey(mainMove))
    .sort((a, b) => Number(Boolean(position.board[b.to])) - Number(Boolean(position.board[a.to])))
    .slice(0, 2)
  const options = [mainMove, ...alternatives]
  const offset = seed % options.length
  return [...options.slice(offset), ...options.slice(0, offset)]
}
