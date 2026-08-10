import { START_FEN, fromFEN } from '../chess/fen'
import { moveFromICCS } from '../chess/notation'
import { makeMove } from '../chess/position'
import type { Position } from '../chess/types'
import type { VariationNode, VariationTree } from '../stores/exploreStore'
import { mainlineMovesFromTree } from './tree'

export type QipuFormat = 'xiangqi-study-v1'

export interface QipuMove {
  move: string
  note?: string
  variations?: QipuMove[][]
}

export interface QipuRecord {
  format: QipuFormat
  id: string
  title: string
  rootFen?: string
  summary: string
  tags: string[]
  source?: {
    title: string
    url: string
    note?: string
  }
  note?: string
  line: QipuMove[]
}

export function qipuToVariationTree(qipu: QipuRecord): VariationTree {
  const rootFen = qipu.rootFen ?? START_FEN
  const root: VariationNode = {
    id: stableNodeId(qipu.id, 'root'),
    move: null,
    note: qipu.note ?? qipu.summary,
    children: [],
  }
  appendLine(root, fromFEN(rootFen), qipu.line, qipu.id, 'm')
  return { rootFen, root, currentNodeId: root.id }
}

export function qipuToMainlineMoves(qipu: QipuRecord): string[] {
  return mainlineMovesFromTree(qipuToVariationTree(qipu))
}

function appendLine(
  parent: VariationNode,
  pos: Position,
  line: QipuMove[],
  qipuId: string,
  path: string,
): Position {
  const [entry, ...rest] = line
  if (!entry) return pos

  const move = normalizeMove(entry.move)
  assertMoveHasPiece(pos, move, `${path}.1`)
  const node: VariationNode = {
    id: stableNodeId(qipuId, `${path}.1`),
    move,
    note: entry.note ?? '',
    children: [],
  }
  parent.children.push(node)

  const nextPos = makeMove(pos, moveFromICCS(move))
  const endPos = appendLine(node, nextPos, rest, qipuId, `${path}.1`)
  entry.variations?.forEach((variation, variationIndex) => {
    appendLine(node, nextPos, variation, qipuId, `${path}.1v${variationIndex + 1}`)
  })

  return endPos
}

function normalizeMove(move: string): string {
  return move.trim().toLowerCase().replace('-', '')
}

function assertMoveHasPiece(pos: Position, move: string, path: string) {
  const parsed = moveFromICCS(move)
  if (!pos.board[parsed.from]) {
    throw new Error(`棋谱 ${path} 的 ${move} 起点没有棋子`)
  }
}

function stableNodeId(qipuId: string, path: string): string {
  return `qipu:${qipuId}:${path}`
}
