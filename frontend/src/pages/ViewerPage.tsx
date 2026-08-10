import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Exploration, Game } from '../api/client'
import { getGame as getRemoteGame } from '../api/client'
import { getGame as getLocalGame, listExplorations, removeGame } from '../offline/repo'
import Board from '../components/board/Board'
import EvalBar from '../components/EvalBar'
import MoveList from '../components/MoveList'
import { useAnalysis } from '../api/analysis'
import { gameStatus } from '../chess/movegen'
import { fromFEN } from '../chess/fen'
import { moveFromICCS, moveToChinese } from '../chess/notation'
import { makeMove } from '../chess/position'
import { toFEN } from '../chess/fen'
import type { Color, Move, Position } from '../chess/types'
import type { VariationTree } from '../stores/exploreStore'
import { lineToVariationTree, mainlineMovesFromTree } from '../qipu/tree'

function ViewerLoading() {
  return <p className="text-sm text-gray-500">加载中…</p>
}

// 棋盘 + 可开关的引擎分析评分条
export function ViewerBoard({
  pos,
  lastMove,
  moveColor,
  onMove,
  initialFlipped = false,
}: {
  pos: Position
  lastMove: Move | null
  moveColor?: Position['turn']
  onMove?: (m: Move) => void
  initialFlipped?: boolean
}) {
  const [analyzing, setAnalyzing] = useState(false)
  const [flipped, setFlipped] = useState(initialFlipped)
  const fen = analyzing && gameStatus(pos) === 'ongoing' ? toFEN(pos) : null
  const analysis = useAnalysis(fen)
  const engineText = analysis.engine
    ? `${analysis.engine.name} / ${analysis.engine.protocol.toUpperCase()}`
    : null
  useEffect(() => {
    setFlipped(initialFlipped)
  }, [initialFlipped])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={analyzing}
            onChange={(e) => setAnalyzing(e.target.checked)}
            className="accent-amber-700"
          />
          引擎分析
        </label>
        <label className="flex items-center gap-1.5 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={flipped}
            onChange={(e) => setFlipped(e.target.checked)}
            className="accent-amber-700"
          />
          {flipped ? '红方视角' : '黑方视角'}
        </label>
        {analyzing && (
          <div className="flex-1">
            {analysis.error ? (
              <span className="text-xs text-red-600">分析不可用（离线或引擎错误）</span>
            ) : (
              <div className="flex flex-col gap-1">
                {engineText && <span className="text-xs text-gray-500">引擎：{engineText}</span>}
                <EvalBar
                  scoreCp={analysis.scoreCp}
                  scoreMate={analysis.scoreMate}
                  depth={analysis.depth}
                  pending={analysis.pending}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <Board position={pos} lastMove={lastMove} moveColor={moveColor} onMove={onMove} flipped={flipped} />
    </div>
  )
}

function inferPlayerSide(game: Game): Color {
  const redIsPlayer = game.redPlayer.includes('玩家')
  const blackIsPlayer = game.blackPlayer.includes('玩家')
  if (blackIsPlayer && !redIsPlayer) return 'b'
  return 'r'
}

function treeForGame(game: Game): VariationTree {
  return (game.tree as VariationTree | undefined) ?? lineToVariationTree(game.moves, game.initialFen, {
    nodeIdPrefix: game.id,
  })
}

export default function ViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [game, setGame] = useState<Game | null>(null)
  const [explorations, setExplorations] = useState<Exploration[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // 当前显示第几步之后的局面（0 = 初始）
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isPublicView = params.get('public') === '1'
  const isRemoteView = isPublicView || params.get('remote') === '1'

  useEffect(() => {
    if (!id) return
    ;(isRemoteView ? getRemoteGame(id) : getLocalGame(id))
      .then((g) => {
        if (!g) {
          setError('棋谱不存在（可能尚未同步到本机）')
          return
        }
        setGame(g)
        setStep(mainlineMovesFromTree(treeForGame(g)).length)
      })
      .catch((e) => setError(String(e)))
    if (isRemoteView) {
      setExplorations([])
    } else {
      listExplorations()
        .then((rows) => setExplorations(rows.filter((e) => e.gameId === id)))
        .catch(() => setExplorations([]))
    }
  }, [id, isRemoteView])

  const { positions, moves, movesCN } = useMemo(() => {
    if (!game) return { positions: [] as Position[], moves: [] as Move[], movesCN: [] as string[] }
    const gameMoves = mainlineMovesFromTree(treeForGame(game))
    const positions = [fromFEN(game.initialFen)]
    const moves: Move[] = []
    const movesCN: string[] = []
    for (const iccs of gameMoves) {
      const m = moveFromICCS(iccs)
      movesCN.push(moveToChinese(positions[positions.length - 1], m))
      moves.push(m)
      positions.push(makeMove(positions[positions.length - 1], m))
    }
    return { positions, moves, movesCN }
  }, [game])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
      if (e.key === 'ArrowRight') setStep((s) => Math.min(moves.length, s + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moves.length])

  if (error) return <p className="text-sm text-red-600">加载失败：{error}</p>
  if (!game) return <ViewerLoading />

  const pos = positions[step]
  const lastMove = step > 0 ? moves[step - 1] : null
  const playerSide = inferPlayerSide(game)
  const playerSideParam = playerSide === 'b' ? '&side=b' : ''

  async function onDeleteGame() {
    if (!id || isRemoteView || deleting) return
    if (!confirm('确定删除这局棋谱？删除后会从你的棋谱库移除。')) return
    setDeleting(true)
    try {
      await removeGame(id)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="w-full max-w-xl">
        <ViewerBoard pos={pos} lastMove={lastMove} initialFlipped={playerSide === 'b'} />
      </div>
      <div className="flex w-full flex-col gap-4 lg:w-72">
        <div className="rounded-lg border border-amber-200 bg-white p-4">
          <h2 className="font-semibold text-amber-900">{game.title || '未命名对局'}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {moves.length} 着 · {game.result === '*' ? '未完' : game.result}
          </p>
          <div className="mt-3 flex gap-2">
            {[
              ['⏮', () => setStep(0)],
              ['◀', () => setStep(Math.max(0, step - 1))],
              ['▶', () => setStep(Math.min(moves.length, step + 1))],
              ['⏭', () => setStep(moves.length)],
            ].map(([label, fn], i) => (
              <button
                key={i}
                className="flex-1 rounded-md border border-amber-300 py-1 text-amber-900 hover:bg-amber-100"
                onClick={fn as () => void}
              >
                {label as string}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">提示：可用 ← / → 键翻步</p>
          <button
            className="mt-3 w-full rounded-md border border-amber-300 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            onClick={() =>
              navigate(`/explore?fen=${encodeURIComponent(toFEN(pos))}&game=${game.id}${playerSideParam}`)
            }
          >
            从此局面开始推演
          </button>
          {!isRemoteView && (
            <button
              className="mt-2 w-full rounded-md border border-red-200 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              onClick={() => void onDeleteGame()}
              disabled={deleting}
              type="button"
            >
              {deleting ? '删除中…' : '删除棋谱'}
            </button>
          )}
          {explorations.length > 0 && (
            <div className="mt-3 border-t border-amber-100 pt-3">
              <p className="mb-2 text-xs font-medium text-amber-900">继续已有推演</p>
              <div className="flex flex-col gap-1.5">
                {explorations.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    className="rounded-md border border-amber-200 px-2 py-1.5 text-left text-sm text-amber-900 hover:bg-amber-100"
                    onClick={() => navigate(`/explore/${e.id}${playerSide === 'b' ? '?side=b' : ''}`)}
                  >
                    <span className="block truncate">{e.title || '未命名推演'}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(e.updatedAt).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-amber-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">着法</h2>
          <MoveList moves={movesCN} current={step} onSelect={setStep} />
        </div>
      </div>
    </div>
  )
}
