import { create } from 'zustand'
import type { Color, Move, Position } from '../chess/types'
import { opposite } from '../chess/types'
import { START_FEN, fromFEN, toFEN } from '../chess/fen'
import { isLegal, makeMove } from '../chess/position'
import { gameStatus } from '../chess/movegen'
import { moveFromICCS, moveToICCS } from '../chess/notation'
import { requestEngineMove } from '../api/client'
import type { EngineConfig } from '../api/client'
import { saveGame as persistGame } from '../offline/repo'
import { lineToVariationTree } from '../qipu/tree'

export type PlayMode = 'hotseat' | 'ai'

export interface PlayConfig {
  mode: PlayMode
  aiLevel: number
  playerColor: Color
}

export interface PlayStartOptions {
  initialFen?: string
  draftTitle?: string
}

export interface Score {
  cp?: number
  mate?: number
  engine?: EngineConfig
}

interface PlayState {
  // positions[i] 是第 i 步之前的局面；最后一项为当前局面
  positions: Position[]
  moves: Move[]
  initialFen: string
  draftGameId: string | null
  draftTitle: string
  draftCreatedAt: number | null
  config: PlayConfig
  thinking: boolean
  engineError: string | null
  // 引擎最近一次评估（红方视角）
  lastScore: Score | null
  // 换局计数器，用于丢弃过期的引擎响应
  gameId: number
  start: (config: PlayConfig, options?: PlayStartOptions) => void
  playUser: (m: Move) => void
  undo: () => void
}

function initial(initialFen = START_FEN) {
  return {
    positions: [fromFEN(initialFen)],
    moves: [] as Move[],
    initialFen,
    draftGameId: null,
    draftTitle: '',
    draftCreatedAt: null,
    thinking: false,
    engineError: null,
    lastScore: null,
  }
}

function playersForConfig(config: PlayConfig) {
  if (config.mode !== 'ai') {
    return { redPlayer: '玩家', blackPlayer: '玩家' }
  }
  const ai = `电脑(${config.aiLevel}级)`
  return config.playerColor === 'r'
    ? { redPlayer: '玩家', blackPlayer: ai }
    : { redPlayer: ai, blackPlayer: '玩家' }
}

function gameResultFromPosition(pos: Position): string {
  const status = gameStatus(pos)
  if (status === 'ongoing') return '*'
  return pos.turn === 'b' ? '1-0' : '0-1'
}

function persistDraftPlay(
  config: PlayConfig,
  draftGameId: string | null,
  draftTitle: string,
  draftCreatedAt: number | null,
  initialFen: string,
  moves: Move[],
  positions: Position[],
) {
  if (config.mode !== 'ai' || !draftGameId) return

  const now = Date.now()
  const last = positions[positions.length - 1]
  const { redPlayer, blackPlayer } = playersForConfig(config)
  const iccsMoves = moves.map(moveToICCS)
  void persistGame({
    id: draftGameId,
    title: draftTitle || `对局 ${new Date(now).toLocaleDateString()}`,
    redPlayer,
    blackPlayer,
    result: gameResultFromPosition(last),
    initialFen,
    moves: iccsMoves,
    tree: lineToVariationTree(iccsMoves, initialFen, { nodeIdPrefix: draftGameId }),
    source: 'play',
    createdAt: draftCreatedAt ?? now,
    updatedAt: now,
    deleted: false,
  })
}

export const usePlayStore = create<PlayState>((set, get) => {
  function current(): Position {
    const { positions } = get()
    return positions[positions.length - 1]
  }

  function aiTurn(): boolean {
    const { config } = get()
    return config.mode === 'ai' && current().turn === opposite(config.playerColor)
  }

  async function maybeRequestAI() {
    if (!aiTurn() || gameStatus(current()) !== 'ongoing') return
    const { gameId, config, draftGameId, draftTitle, draftCreatedAt, initialFen, positions, moves } = get()
    set({ thinking: true, engineError: null })
    try {
      const res = await requestEngineMove(toFEN(current()), config.aiLevel)
      if (get().gameId !== gameId) return // 已换局，丢弃
      const m = moveFromICCS(res.bestMove)
      if (!isLegal(current(), m)) throw new Error(`引擎返回非法着法 ${res.bestMove}`)
      const nextPos = makeMove(current(), m)
      const nextMoves = [...moves, m]
      const nextPositions = [...positions, nextPos]
      set({
        positions: nextPositions,
        moves: nextMoves,
        thinking: false,
        lastScore: { cp: res.scoreCp, mate: res.scoreMate, engine: res.engine },
      })
      persistDraftPlay(config, draftGameId, draftTitle, draftCreatedAt, initialFen, nextMoves, nextPositions)
    } catch (err) {
      if (get().gameId !== gameId) return
      set({ thinking: false, engineError: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    ...initial(),
    config: { mode: 'hotseat', aiLevel: 3, playerColor: 'r' },
    gameId: 0,
    start: (config, options = {}) => {
      const now = Date.now()
      const initialFen = options.initialFen ?? START_FEN
      const draftGameId = config.mode === 'ai' ? crypto.randomUUID() : null
      const draftTitle =
        config.mode === 'ai' ? (options.draftTitle ?? `对局 ${new Date(now).toLocaleDateString()}`) : ''
      set((s) => ({
        ...initial(initialFen),
        config,
        gameId: s.gameId + 1,
        draftGameId,
        draftTitle,
        draftCreatedAt: draftGameId ? now : null,
      }))
      void maybeRequestAI() // 玩家执黑时引擎先走
    },
    playUser: (m) => {
      const { thinking, config, moves, positions, draftGameId, draftTitle, draftCreatedAt, initialFen } = get()
      if (thinking) return
      const currentPos = positions[positions.length - 1]
      const nextPos = makeMove(currentPos, m)
      const nextMoves = [...moves, m]
      const nextPositions = [...positions, nextPos]
      set({
        positions: nextPositions,
        moves: nextMoves,
        engineError: null,
      })
      persistDraftPlay(config, draftGameId, draftTitle, draftCreatedAt, initialFen, nextMoves, nextPositions)
      void maybeRequestAI()
    },
    undo: () => {
      const { thinking, config, moves, positions, draftGameId, draftTitle, draftCreatedAt, initialFen } = get()
      if (thinking || moves.length === 0) return
      // 人机模式退回到玩家行棋前；双人退一步
      let n = 1
      if (config.mode === 'ai') {
        n = current().turn === config.playerColor ? 2 : 1
      }
      n = Math.min(n, moves.length)
      const nextMoves = moves.slice(0, moves.length - n)
      const nextPositions = positions.slice(0, positions.length - n)
      set({
        positions: nextPositions,
        moves: nextMoves,
        lastScore: null,
      })
      persistDraftPlay(config, draftGameId, draftTitle, draftCreatedAt, initialFen, nextMoves, nextPositions)
    },
  }
})
