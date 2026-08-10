import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  cancelOnlineMatch,
  createOnlineRoom,
  getOnlineMatch,
  joinOnlineRoom,
  playOnlineMove,
  resumeOnlineMatch,
  resignOnlineMatch,
  startOnlineMatch,
} from '../api/client'
import { listPublicGames } from '../api/client'
import type { OnlineMatch } from '../api/client'
import type { Game } from '../api/client'
import { getExploration, saveExploration, saveGame as persistGame } from '../offline/repo'
import { lineToVariationTree } from '../qipu/tree'
import { listGames as listLocalGames } from '../offline/repo'
import { syncNow, useSyncStore } from '../offline/syncQueue'
import { fromFEN } from '../chess/fen'
import { makeMove } from '../chess/position'
import { moveFromICCS, moveToICCS } from '../chess/notation'
import Board from '../components/board/Board'
import MoveList from '../components/MoveList'
import { usePlayStore } from '../stores/playStore'
import type { PlayConfig } from '../stores/playStore'
import { useAuthStore } from '../auth'
import { appendLineToNode } from '../stores/exploreStore'
import type { VariationTree } from '../stores/exploreStore'
import { gameStatus } from '../chess/movegen'
import { moveToChinese } from '../chess/notation'
import { opposite } from '../chess/types'
import { useI18n } from '../i18n'
import { playMessages } from '../playI18n'

const COLOR_NAME = { r: '红方', b: '黑方' } as const
type PlayTab = 'game' | 'history'
type HistoryScope = 'mine' | 'public'
const TIME_OPTIONS = [3, 5, 10, 15, 30] as const
const INCREMENT_OPTIONS = [5, 10, 15, 30, 60] as const
const QIPU_CATEGORIES = ['开局', '中局', '残局', '战术题', '精选', '赛事实战', '社区棋谱'] as const

function formatScore(score: { cp?: number; mate?: number } | null): string | null {
  if (!score) return null
  if (score.mate !== undefined && score.mate !== 0) {
    return score.mate > 0 ? `红方 ${score.mate} 步杀` : `黑方 ${-score.mate} 步杀`
  }
  if (score.cp === undefined) return null
  const v = score.cp / 100
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

function formatClock(ms: number): string {
  const safe = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function buildOnlineLine(match: OnlineMatch | null) {
  if (!match) return null
  const moves = match.moves.map(moveFromICCS)
  const positions = [fromFEN(match.initialFen)]
  for (const move of moves) {
    positions.push(makeMove(positions[positions.length - 1], move))
  }
  return { positions, moves }
}

function notificationSupported(): boolean {
  return 'Notification' in window
}

async function ensureMatchNotificationPermission(): Promise<boolean> {
  if (!notificationSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch (err) {
    console.warn('Notification permission request failed', err)
    return false
  }
}

async function showGameNotification(title: string, options: NotificationOptions) {
  if (!notificationSupported() || Notification.permission !== 'granted') return

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, options)
        return
      }
    } catch (err) {
      console.warn('Service worker notification failed', err)
    }
  }

  try {
    const notification = new Notification(title, options)
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch (err) {
    console.warn('Page notification failed', err)
  }
}

async function notifyMatchReady(match: OnlineMatch) {
  const opponent =
    match.playerColor === 'r'
      ? match.blackPlayer || '对手'
      : match.redPlayer || (match.opponentType === 'bot' ? '电脑' : '对手')
  await showGameNotification('象棋对局已匹配成功', {
    body: `${opponent} 已就位，可以开始对战了。`,
    icon: '/app-icon-192.png',
    tag: `chess-match-${match.id}`,
  })
}

function matchWinnerColor(match: OnlineMatch): 'r' | 'b' | null {
  if (match.result === '1-0') return 'r'
  if (match.result === '0-1') return 'b'
  return null
}

function onlineResultText(match: OnlineMatch, localStatus: ReturnType<typeof gameStatus>, fallbackWinner: string) {
  const winner = matchWinnerColor(match)
  const winnerText = winner ? `${COLOR_NAME[winner]}胜` : `${fallbackWinner}胜`
  if (match.resultReason === 'resign') {
    if (winner && match.playerColor === winner) return '对手已认输，你获胜'
    if (winner && match.playerColor && match.playerColor !== winner) return '你已认输，对手获胜'
    return `${winnerText}（认输）`
  }
  if (match.resultReason === 'timeout') return `${winnerText}（超时）`
  if (match.resultReason === 'checkmate') return `${winnerText}（将死）`
  if (match.resultReason === 'stalemate') return `${winnerText}（困毙）`
  return `${winnerText}（${localStatus === 'checkmate' ? '将死' : '困毙'}）`
}

async function notifyOpponentResigned(match: OnlineMatch) {
  if (match.resultReason !== 'resign' || matchWinnerColor(match) !== match.playerColor) return
  await showGameNotification('对手已认输', {
    body: '这局在线对局已经结束，你获胜了。',
    icon: '/app-icon-192.png',
    tag: `chess-resign-${match.id}`,
  })
}

function OnlineClockBar({ match }: { match: OnlineMatch }) {
  const redActive = match.status === 'active' && match.turn === 'r' && !match.botThinking
  const blackActive = match.status === 'active' && match.turn === 'b' && !match.botThinking
  const clockClass = (active: boolean, color: 'r' | 'b') =>
    `flex min-w-0 flex-1 items-center justify-between rounded-md border px-3 py-2 ${
      active
        ? color === 'r'
          ? 'border-red-300 bg-red-50 text-red-800'
          : 'border-gray-400 bg-gray-200 text-gray-950'
        : 'border-amber-200 bg-white text-gray-600'
    }`

  return (
    <div className="mb-2 flex gap-2 text-sm">
      <div className={clockClass(redActive, 'r')}>
        <span className="truncate font-medium">红方：{match.redPlayer || '红方'}</span>
        <span className="ml-2 shrink-0 font-mono text-lg font-bold">{formatClock(match.redTimeMs)}</span>
      </div>
      <div className={clockClass(blackActive, 'b')}>
        <span className="truncate font-medium">黑方：{match.blackPlayer || '等待中'}</span>
        <span className="ml-2 shrink-0 font-mono text-lg font-bold">{formatClock(match.blackTimeMs)}</span>
      </div>
    </div>
  )
}

function OnlineGameResultOverlay({
  match,
  status,
  winner,
}: {
  match: OnlineMatch
  status: ReturnType<typeof gameStatus>
  winner: string
}) {
  if (match.status !== 'finished') return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="max-w-[80%] rounded-lg border border-amber-300 bg-white/95 px-5 py-4 text-center shadow-lg">
        <div className="text-lg font-bold text-amber-950">{onlineResultText(match, status, winner)}</div>
        {match.resultReason === 'resign' && (
          <div className="mt-1 text-sm text-gray-600">对局已结束</div>
        )}
      </div>
    </div>
  )
}

export default function PlayPage() {
  const { locale } = useI18n()
  const text = playMessages[locale]
  const { positions, moves, initialFen, config, thinking, engineError, lastScore, start, playUser, undo } =
    usePlayStore()
  const [draft, setDraft] = useState<PlayConfig>(config)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [onlineMatch, setOnlineMatch] = useState<OnlineMatch | null>(null)
  const [matching, setMatching] = useState(false)
  const [cancelingOnline, setCancelingOnline] = useState(false)
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [initialMinutes, setInitialMinutes] = useState(10)
  const [incrementSeconds, setIncrementSeconds] = useState(15)
  const [tab, setTab] = useState<PlayTab>('game')
  const [historyScope, setHistoryScope] = useState<HistoryScope>('mine')
  const [history, setHistory] = useState<Game[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyCategory, setHistoryCategory] = useState('')
  const [historyQuery, setHistoryQuery] = useState('')
  const [localGameStarted, setLocalGameStarted] = useState(false)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const online = useSyncStore((s) => s.online)
  const user = useAuthStore((s) => s.user)
  const startedContinuation = useRef<string | null>(null)
  const savedBranchLine = useRef<string | null>(null)
  const notifiedMatchId = useRef<string | null>(null)
  const notifiedResignMatchId = useRef<string | null>(null)
  const onlineRequestSeq = useRef(0)
  const cancelPendingOnline = useRef(false)
  const attemptedResume = useRef(false)

  const continuationFen = params.get('fen')
  const roomCodeParam = params.get('room')
  const continuationExploreId = params.get('explore')
  const continuationNodeId = params.get('node')
  const saveBranch = params.get('saveBranch') === '1'
  const continuationKey = params.toString()
  const continuationTurn = useMemo(() => {
    if (!continuationFen) return null
    try {
      return fromFEN(continuationFen).turn
    } catch {
      return null
    }
  }, [continuationFen])

  const onlineLine = useMemo(() => buildOnlineLine(onlineMatch), [onlineMatch])
  const inviteUrl = useMemo(() => {
    if (!onlineMatch?.roomCode) return ''
    return `${window.location.origin}${window.location.pathname}#/play?room=${onlineMatch.roomCode}`
  }, [onlineMatch?.roomCode])

  useEffect(() => {
    if (attemptedResume.current || !online || onlineMatch || localGameStarted) return
    if (roomCodeParam || continuationFen) return
    attemptedResume.current = true
    let cancelled = false
    void resumeOnlineMatch()
      .then((next) => {
        if (cancelled || !next) return
        setOnlineMatch(next)
        setOnlineError(null)
        setRoomCodeInput(next.roomCode ?? '')
      })
      .catch((err) => {
        if (!cancelled) setOnlineError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [continuationFen, localGameStarted, online, onlineMatch, roomCodeParam])

  useEffect(() => {
    if (!onlineMatch || onlineMatch.status !== 'active') return
    if (notifiedMatchId.current === onlineMatch.id) return
    notifiedMatchId.current = onlineMatch.id
    void notifyMatchReady(onlineMatch)
  }, [onlineMatch])

  useEffect(() => {
    if (!onlineMatch || onlineMatch.status !== 'finished') return
    if (notifiedResignMatchId.current === onlineMatch.id) return
    notifiedResignMatchId.current = onlineMatch.id
    void notifyOpponentResigned(onlineMatch)
  }, [onlineMatch])

  useEffect(() => {
    if (!onlineMatch || onlineMatch.status === 'finished') return
    let cancelled = false
    const id = window.setInterval(() => {
      void getOnlineMatch(onlineMatch.id)
        .then((next) => {
          if (!cancelled) {
            setOnlineMatch(next)
            setOnlineError(null)
          }
        })
        .catch((err) => {
          if (!cancelled) setOnlineError(err instanceof Error ? err.message : String(err))
        })
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [onlineMatch])

  useEffect(() => {
    if (tab !== 'history') return
    let cancelled = false
    void (async () => {
      if (historyScope === 'mine') {
        if (online) await syncNow()
        return listLocalGames()
      }
      return listPublicGames({ category: historyCategory, q: historyQuery, sort: 'newest' })
    })()
      .then((rows) => {
        if (!cancelled) {
          setHistory(rows)
          setHistoryError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [historyCategory, historyQuery, historyScope, online, tab])

  useEffect(() => {
    if (!roomCodeParam || onlineMatch) return
    let cancelled = false
    setMatching(true)
    void joinOnlineRoom(roomCodeParam)
      .then((next) => {
        if (!cancelled) {
          setOnlineMatch(next)
          setRoomCodeInput(next.roomCode ?? roomCodeParam)
          setOnlineError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setOnlineError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setMatching(false)
      })
    return () => {
      cancelled = true
    }
  }, [onlineMatch, roomCodeParam])

  useEffect(() => {
    if (!continuationFen || !continuationTurn || startedContinuation.current === continuationKey) return
    startedContinuation.current = continuationKey
    const nextDraft: PlayConfig = { ...config, mode: 'ai', playerColor: continuationTurn }
    setDraft(nextDraft)
    setLocalGameStarted(true)
    start(nextDraft, {
      initialFen: continuationFen,
      draftTitle: `推演续战 ${new Date().toLocaleDateString()}`,
    })
  }, [config, continuationFen, continuationKey, continuationTurn, start])

  useEffect(() => {
    if (!saveBranch || !continuationExploreId || !continuationNodeId || moves.length === 0) return
    const iccsMoves = moves.map(moveToICCS)
    const saveKey = `${continuationExploreId}:${continuationNodeId}:${iccsMoves.join(',')}`
    if (savedBranchLine.current === saveKey) return
    savedBranchLine.current = saveKey
    let cancelled = false
    void getExploration(continuationExploreId)
      .then(async (exploration) => {
        if (!exploration || cancelled) return
        const result = appendLineToNode(exploration.tree as VariationTree, continuationNodeId, iccsMoves)
        if (!result) throw new Error('原推演节点不存在，无法保存新分支')
        if (!result.changed) return
        await saveExploration({
          ...exploration,
          tree: { ...result.tree, currentNodeId: result.currentNodeId },
          updatedAt: Date.now(),
        })
        if (!cancelled) setBranchError(null)
      })
      .catch((err) => {
        if (!cancelled) setBranchError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [continuationExploreId, continuationNodeId, moves, saveBranch])

  async function saveGame() {
    const title = prompt('棋谱标题：', `对局 ${new Date().toLocaleDateString()}`)
    if (title === null) return
    const now = Date.now()
    const status = gameStatus(positions[positions.length - 1])
    const result =
      status === 'ongoing' ? '*' : positions[positions.length - 1].turn === 'b' ? '1-0' : '0-1'
    const id = crypto.randomUUID()
    const isPublic = confirm('是否公开这局棋谱到公共历史？\n选择“取消”会只保存到我的历史。')
    const iccsMoves = moves.map(moveToICCS)
    await persistGame({
      id,
      title,
      redPlayer: config.mode === 'ai' && config.playerColor === 'b' ? `电脑(${config.aiLevel}级)` : '玩家',
      blackPlayer: config.mode === 'ai' && config.playerColor === 'r' ? `电脑(${config.aiLevel}级)` : '玩家',
      result,
      initialFen,
      moves: iccsMoves,
      tree: lineToVariationTree(iccsMoves, initialFen, { nodeIdPrefix: id }),
      source: 'play',
      isPublic,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    })
    navigate(`/games/${id}`)
  }

  function startLocalGame() {
    setOnlineMatch(null)
    setOnlineError(null)
    setLocalGameStarted(true)
    start(draft)
  }

  async function matchOnline() {
    const requestSeq = ++onlineRequestSeq.current
    cancelPendingOnline.current = false
    void ensureMatchNotificationPermission()
    setLocalGameStarted(false)
    setMatching(true)
    setOnlineError(null)
    try {
      const next = await startOnlineMatch(draft.aiLevel, {
        initialTimeMs: initialMinutes * 60 * 1000,
        incrementMs: incrementSeconds * 1000,
      })
      if (cancelPendingOnline.current || requestSeq !== onlineRequestSeq.current) {
        if (next.status === 'waiting') await cancelOnlineMatch(next.id).catch(() => undefined)
        return
      }
      setOnlineMatch(next)
    } catch (err) {
      if (requestSeq === onlineRequestSeq.current) {
        setOnlineError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (requestSeq === onlineRequestSeq.current) setMatching(false)
    }
  }

  async function createRoom() {
    const requestSeq = ++onlineRequestSeq.current
    cancelPendingOnline.current = false
    void ensureMatchNotificationPermission()
    setLocalGameStarted(false)
    setMatching(true)
    setOnlineError(null)
    setInviteCopied(false)
    try {
      const next = await createOnlineRoom({
        initialTimeMs: initialMinutes * 60 * 1000,
        incrementMs: incrementSeconds * 1000,
      })
      if (cancelPendingOnline.current || requestSeq !== onlineRequestSeq.current) {
        if (next.status === 'waiting') await cancelOnlineMatch(next.id).catch(() => undefined)
        return
      }
      setOnlineMatch(next)
      setRoomCodeInput(next.roomCode ?? '')
    } catch (err) {
      if (requestSeq === onlineRequestSeq.current) {
        setOnlineError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (requestSeq === onlineRequestSeq.current) setMatching(false)
    }
  }

  async function joinRoom() {
    const code = roomCodeInput.trim()
    if (!code) return
    void ensureMatchNotificationPermission()
    setLocalGameStarted(false)
    setMatching(true)
    setOnlineError(null)
    try {
      const next = await joinOnlineRoom(code)
      setOnlineMatch(next)
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : String(err))
    } finally {
      setMatching(false)
    }
  }

  async function copyInviteLink() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setInviteCopied(true)
  }

  async function cancelOnlineWaiting() {
    cancelPendingOnline.current = true
    onlineRequestSeq.current += 1
    setMatching(false)
    setOnlineError(null)
    if (!onlineMatch || onlineMatch.status !== 'waiting') {
      setOnlineMatch(null)
      return
    }
    setCancelingOnline(true)
    try {
      await cancelOnlineMatch(onlineMatch.id)
      setOnlineMatch(null)
      setRoomCodeInput('')
      setInviteCopied(false)
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : String(err))
    } finally {
      setCancelingOnline(false)
    }
  }

  async function playOnline(m: Parameters<typeof playUser>[0]) {
    if (!onlineMatch || onlineMatch.status !== 'active') return
    setOnlineError(null)
    try {
      const next = await playOnlineMove(onlineMatch.id, moveToICCS(m))
      setOnlineMatch(next)
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : String(err))
    }
  }

  async function resignOnline() {
    if (!onlineMatch) return
    const ok = confirm('确定认输并结束这局吗？')
    if (!ok) return
    try {
      const next = await resignOnlineMatch(onlineMatch.id)
      setOnlineMatch(next)
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : String(err))
    }
  }

  const displayPositions = onlineLine?.positions ?? positions
  const displayMoves = onlineLine?.moves ?? moves
  const pos = displayPositions[displayPositions.length - 1]
  const status = gameStatus(pos)
  const lastMove = displayMoves.length > 0 ? displayMoves[displayMoves.length - 1] : null
  const movesCN = useMemo(
    () => displayMoves.map((m, i) => moveToChinese(displayPositions[i], m)),
    [displayMoves, displayPositions],
  )

  const onlineGameOver = onlineMatch?.status === 'finished'
  const gameOver = onlineGameOver || status !== 'ongoing'
  const winner = COLOR_NAME[opposite(pos.turn)]
  const onlineSavedGameId = onlineMatch && user ? `${onlineMatch.id}-${user.id}` : null
  const scoreText = formatScore(lastScore)
  const engineText = lastScore?.engine
    ? `${lastScore.engine.name} / ${lastScore.engine.protocol.toUpperCase()}`
    : null

  // 可走子的一方：双人 = 轮谁谁走；人机 = 仅玩家一方
  const onlineRunning = onlineMatch?.status === 'active'
  const onlineWaiting = matching || onlineMatch?.status === 'waiting'
  const showBoard = localGameStarted || onlineRunning || onlineMatch?.status === 'finished'
  const onlineMyTurn = onlineRunning && onlineMatch.turn === onlineMatch.playerColor && !onlineMatch.botThinking
  const moveColor = onlineMatch
    ? onlineMyTurn
      ? pos.turn
      : undefined
    : gameOver || thinking
      ? undefined
      : config.mode === 'hotseat'
        ? pos.turn
        : config.playerColor

  const tabClass = (value: PlayTab) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      tab === value ? 'bg-amber-700 text-white' : 'text-amber-900 hover:bg-amber-200'
    }`

  const historyScopeClass = (value: HistoryScope) =>
    `rounded-md px-2.5 py-1 text-xs font-medium ${
      historyScope === value ? 'bg-amber-700 text-white' : 'text-amber-900 hover:bg-amber-100'
    }`

  const setupPanel = (
    <div className="rounded-lg border border-amber-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-amber-900">{text.newGame}</h2>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex gap-2">
          {(['ai', 'hotseat'] as const).map((mode) => (
            <button
              key={mode}
              className={`flex-1 rounded-md border px-2 py-1 ${
                draft.mode === mode
                  ? 'border-amber-700 bg-amber-700 text-white'
                  : 'border-amber-300 text-amber-900 hover:bg-amber-100'
              }`}
              onClick={() => setDraft({ ...draft, mode })}
            >
              {mode === 'ai' ? text.vsComputer : text.twoPlayers}
            </button>
          ))}
        </div>
        {draft.mode === 'ai' && !online && (
          <p className="rounded-md bg-gray-100 p-2 text-xs text-gray-500">
            {text.offlineAiUnavailable}
          </p>
        )}
        {draft.mode === 'ai' && (
          <>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap text-gray-600">{text.difficulty} {draft.aiLevel}</span>
              <input
                type="range"
                min="1"
                max="10"
                value={draft.aiLevel}
                onChange={(e) => setDraft({ ...draft, aiLevel: Number(e.target.value) })}
                className="w-full accent-amber-700"
              />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">{text.playAs}</span>
              {(['r', 'b'] as const).map((c) => (
                <button
                  key={c}
                  className={`rounded-md border px-3 py-1 ${
                    draft.playerColor === c
                      ? 'border-amber-700 bg-amber-700 text-white'
                      : 'border-amber-300 text-amber-900 hover:bg-amber-100'
                  }`}
                  onClick={() => setDraft({ ...draft, playerColor: c })}
                >
                  {c === 'r' ? text.white : text.black}
                </button>
              ))}
            </div>
          </>
        )}
        <button
          className="rounded-md bg-amber-700 px-3 py-1.5 font-medium text-white hover:bg-amber-800"
          onClick={startLocalGame}
        >
          {text.start}
        </button>
        <button
          className="rounded-md border border-amber-700 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          disabled={!online || matching}
          onClick={() => void matchOnline()}
          type="button"
        >
          {matching ? text.matching : text.onlineMatch}
        </button>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
          <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1 text-gray-600">
              {text.initialTime}
              <select
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-sm text-amber-950 outline-none focus:border-amber-600"
                value={initialMinutes}
                onChange={(event) => setInitialMinutes(Number(event.target.value))}
              >
                {TIME_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} {text.minutes}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-gray-600">
              {text.increment}
              <select
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-sm text-amber-950 outline-none focus:border-amber-600"
                value={incrementSeconds}
                onChange={(event) => setIncrementSeconds(Number(event.target.value))}
              >
                {INCREMENT_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    +{seconds} {text.seconds}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-md bg-amber-800 px-3 py-1.5 font-medium text-white hover:bg-amber-900 disabled:opacity-50"
              disabled={!online || matching}
              onClick={() => void createRoom()}
              type="button"
            >
              {text.createRoom}
            </button>
            <button
              className="rounded-md border border-amber-300 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              disabled={!online || matching || !roomCodeInput.trim()}
              onClick={() => void joinRoom()}
              type="button"
            >
              {text.join}
            </button>
          </div>
          <input
            className="mt-2 w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-sm uppercase text-amber-950 outline-none focus:border-amber-600"
            onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
            placeholder={text.roomCodePlaceholder}
            value={roomCodeInput}
          />
        </div>
        <p className="text-xs text-gray-500">
          {text.matchmakingHint}
        </p>
      </div>
    </div>
  )

  const waitingPanel = onlineWaiting ? (
    <div className="mx-auto max-w-xl rounded-lg border border-amber-200 bg-white p-6 text-center">
      <p className="animate-pulse text-base font-semibold text-amber-800">
        {onlineMatch?.roomCode
          ? '好友房已创建，等待好友加入...'
          : matching
            ? '正在连接在线对局...'
            : '正在匹配真人，匹配不到会自动进入人机局...'}
      </p>
      {onlineMatch?.roomCode && (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-gray-700">
          <div className="font-medium text-amber-950">房间码：{onlineMatch.roomCode}</div>
          <button
            className="mt-1 font-medium text-amber-800 hover:text-amber-950"
            onClick={() => void copyInviteLink()}
            type="button"
          >
            {inviteCopied ? '已复制邀请链接' : '复制邀请链接'}
          </button>
        </div>
      )}
      <button
        className="mt-4 rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        disabled={cancelingOnline}
        onClick={() => void cancelOnlineWaiting()}
        type="button"
      >
        {cancelingOnline ? '取消中...' : '取消'}
      </button>
      {onlineError && <p className="mt-3 text-sm text-red-600">在线对局错误：{onlineError}</p>}
    </div>
  ) : null

  if (tab === 'history') {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-2">
          <button className={tabClass('game')} onClick={() => setTab('game')} type="button">
            {text.game}
          </button>
          <button className={tabClass('history')} onClick={() => setTab('history')} type="button">
            {text.history}
          </button>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-amber-950">对战历史</h2>
              <div className="mt-2 flex gap-1">
                <button
                  className={historyScopeClass('mine')}
                  onClick={() => {
                    setHistory(null)
                    setHistoryScope('mine')
                  }}
                  type="button"
                >
                  我的
                </button>
                <button
                  className={historyScopeClass('public')}
                  onClick={() => {
                    setHistory(null)
                    setHistoryScope('public')
                  }}
                  type="button"
                >
                  公共
                </button>
              </div>
            </div>
            <button
              className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
              onClick={() => {
                setHistory(null)
                setTab('history')
                void (async () => {
                  if (historyScope === 'mine') {
                    if (online) await syncNow()
                    return listLocalGames()
                  }
                  return listPublicGames({ category: historyCategory, q: historyQuery, sort: 'newest' })
                })().then(setHistory).catch((err) => setHistoryError(String(err)))
              }}
              type="button"
            >
              刷新
            </button>
          </div>
          {historyScope === 'public' && (
            <div className="mb-4 grid gap-2 rounded-xl bg-amber-50 p-3 shadow-[0_0_0_1px_rgba(120,53,15,0.08)] sm:grid-cols-[minmax(0,1fr)_9rem]">
              <label className="sr-only" htmlFor="qipu-search">搜索公共棋谱</label>
              <input
                id="qipu-search"
                className="w-full rounded-lg border border-amber-200 px-3 text-sm outline-none"
                onChange={(event) => {
                  setHistory(null)
                  setHistoryQuery(event.target.value)
                }}
                placeholder="搜索棋手、赛事、开局…"
                type="search"
                value={historyQuery}
              />
              <label className="sr-only" htmlFor="qipu-category">棋谱分类</label>
              <select
                id="qipu-category"
                className="w-full rounded-lg border border-amber-200 px-3 text-sm outline-none"
                onChange={(event) => {
                  setHistory(null)
                  setHistoryCategory(event.target.value)
                }}
                value={historyCategory}
              >
                <option value="">全部分类</option>
                {QIPU_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
          )}
          {historyError && <p className="text-sm text-red-600">加载失败：{historyError}</p>}
          {!history && !historyError && <p className="text-sm text-gray-500">加载中...</p>}
          {history?.length === 0 && (
            <p className="rounded-md bg-amber-50 p-6 text-center text-sm text-gray-500">
              {historyScope === 'mine'
                ? '还没有对战历史。完成一局或保存棋谱后会出现在这里。'
                : '还没有公共棋谱。'}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {history?.map((game) => (
              <li
                key={game.id}
                className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgba(120,53,15,0.08),0_2px_8px_rgba(120,53,15,0.06)]"
              >
                <Link
                  className="min-w-0 flex-1"
                  to={`/games/${game.id}${historyScope === 'public' ? '?public=1' : ''}`}
                >
                  <p className="truncate font-medium text-amber-950">{game.title || '未命名对局'}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {game.redPlayer || '红方'} vs {game.blackPlayer || '黑方'} · {game.moves.length} 着 ·{' '}
                    {game.result === '*' ? '未完' : game.result}
                  </p>
                  {historyScope === 'public' && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {game.category && <span className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-900">{game.category}</span>}
                      {game.opening && <span className="max-w-full truncate rounded-md bg-gray-100 px-2 py-1 text-gray-700">{game.opening}</span>}
                    </div>
                  )}
                </Link>
                <div className="flex shrink-0 flex-col gap-1">
                  <Link
                    className="flex min-h-10 items-center rounded-lg border border-amber-300 px-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
                    to={`/games/${game.id}${historyScope === 'public' ? '?public=1' : ''}`}
                  >
                    回顾 / 分析
                  </Link>
                  {historyScope === 'public' && game.sourceUrl && (
                    <a className="flex min-h-10 items-center justify-center text-xs text-gray-500 hover:text-amber-900" href={game.sourceUrl} rel="noreferrer" target="_blank">来源</a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button className={tabClass('game')} onClick={() => setTab('game')} type="button">
          {text.game}
        </button>
        <button className={tabClass('history')} onClick={() => setTab('history')} type="button">
          {text.history}
        </button>
      </div>
      {onlineWaiting ? (
        waitingPanel
      ) : !showBoard ? (
        <div className="mx-auto max-w-xl">{setupPanel}</div>
      ) : (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full max-w-xl">
          {onlineMatch && <OnlineClockBar match={onlineMatch} />}
          <div className="relative">
            <Board
              position={pos}
              lastMove={lastMove}
              moveColor={moveColor}
              onMove={onlineMatch ? playOnline : playUser}
              flipped={onlineMatch ? onlineMatch.playerColor === 'b' : config.mode === 'ai' && config.playerColor === 'b'}
            />
            {onlineMatch && (
              <OnlineGameResultOverlay match={onlineMatch} status={status} winner={winner} />
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-72">
        {!onlineMatch && setupPanel}

        {/* 对局状态 */}
        <div className="rounded-lg border border-amber-200 bg-white p-4 text-sm">
          {onlineMatch?.status === 'waiting' ? (
            <p className="animate-pulse font-medium text-amber-700">
              {onlineMatch.roomCode
                ? '好友房已创建，等待好友加入...'
                : '正在匹配真人，匹配不到会自动进入人机局...'}
            </p>
          ) : gameOver ? (
            <p className="font-bold text-red-700">
              {onlineMatch
                ? onlineResultText(onlineMatch, status, winner)
                : `${winner}胜（${status === 'checkmate' ? '将死' : '困毙'}）`}
            </p>
          ) : thinking || onlineMatch?.botThinking ? (
            <p className="animate-pulse font-medium text-amber-700">{text.engineThinking}</p>
          ) : (
            <p className="font-medium">
              {text.turn}{' '}
              <span className={pos.turn === 'r' ? 'text-red-700' : 'text-gray-800'}>
                {pos.turn === 'r' ? text.white : text.black}
              </span>{' '}
              {text.toMove}
            </p>
          )}
          {onlineError && <p className="mt-1 text-xs text-red-600">在线对局错误：{onlineError}</p>}
          {engineText && <p className="mt-1 text-xs text-gray-500">引擎：{engineText}</p>}
          {scoreText && <p className="mt-1 text-xs text-gray-500">引擎评估（红方视角）：{scoreText}</p>}
          {engineError && <p className="mt-1 text-xs text-red-600">引擎错误：{engineError}</p>}
          {saveBranch && !branchError && (
            <p className="mt-1 text-xs text-gray-500">新增走法会保存为推演分支</p>
          )}
          {branchError && <p className="mt-1 text-xs text-red-600">分支保存失败：{branchError}</p>}
          <div className="mt-2 flex gap-2">
            {onlineMatch ? (
              onlineMatch.status === 'finished' ? (
                <>
                  <span className="rounded-md bg-amber-50 px-3 py-1 text-sm text-gray-600">
                    已自动保存
                  </span>
                  {onlineSavedGameId && (
                    <button
                      className="rounded-md border border-amber-300 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100"
                      onClick={() => navigate(`/games/${onlineSavedGameId}?remote=1`)}
                      type="button"
                    >
                      回放 / 分析
                    </button>
                  )}
                </>
              ) : (
                <button
                  className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
                  onClick={() => void resignOnline()}
                >
                  认输
                </button>
              )
            ) : (
              <>
                <button
                  className="rounded-md border border-amber-300 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
                  onClick={undo}
                  disabled={moves.length === 0 || thinking}
                >
                  {text.undo}
                </button>
                <button
                  className="rounded-md border border-amber-300 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
                  onClick={() => void saveGame()}
                  disabled={moves.length === 0 || thinking}
                >
                  {text.saveGame}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 着法 */}
        <div className="rounded-lg border border-amber-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">{text.moves}</h2>
          <MoveList moves={movesCN} />
        </div>
        </div>
      </div>
      )}
    </div>
  )
}
