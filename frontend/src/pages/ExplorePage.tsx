import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Exploration } from '../api/client'
import NoteEditor from '../components/NoteEditor'
import { ViewerBoard } from './ViewerPage'
import VariationTree from '../components/VariationTree'
import { findPath, positionAt, useExploreStore } from '../stores/exploreStore'
import { moveFromICCS } from '../chess/notation'
import { toFEN } from '../chess/fen'
import { listExplorations } from '../offline/repo'
import { getPublicQipu } from '../qipu/publicQipu'

export default function ExplorePage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [existing, setExisting] = useState<Exploration[]>([])
  const [saveBranch, setSaveBranch] = useState(true)
  const s = useExploreStore()
  const queryKey = params.toString()
  const gameId = params.get('game')
  const qipuId = params.get('qipu')
  const qipu = qipuId ? getPublicQipu(qipuId) : undefined
  const initialFlipped = params.get('side') === 'b'
  const continuable = useMemo(
    () => existing.filter((e) => !gameId || e.gameId === gameId).slice(0, 4),
    [existing, gameId],
  )

  useEffect(() => {
    if (id) {
      void s.load(id)
    } else if (qipu) {
      s.loadQipu(qipu)
    } else {
      s.fresh(params.get('fen') ?? undefined, params.get('game'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, queryKey])

  useEffect(() => {
    if (id) return
    void listExplorations()
      .then((rows) => setExisting(rows))
      .catch(() => setExisting([]))
  }, [id])

  async function onSave() {
    await s.save()
    const latest = useExploreStore.getState()
    if (!id && !latest.error) navigate(`/explore/${latest.id}`, { replace: true })
  }

  async function continueVsAI() {
    let explorationId = id ?? null
    let nodeId = currentNode.id
    if (saveBranch && (!s.persisted || s.dirty)) {
      await s.save()
      const latest = useExploreStore.getState()
      if (latest.error) return
      explorationId = latest.id
      nodeId = latest.currentNodeId
    }
    const next = new URLSearchParams({ fen: toFEN(pos), saveBranch: saveBranch ? '1' : '0' })
    if (saveBranch && explorationId) {
      next.set('explore', explorationId)
      next.set('node', nodeId)
    }
    navigate(`/play?${next.toString()}`)
  }

  const pos = useMemo(
    () => positionAt(s.tree, s.currentNodeId),
    [s.tree, s.currentNodeId],
  )
  const currentPath = useMemo(() => {
    const path = findPath(s.tree.root, s.currentNodeId)
    return path ?? [s.tree.root]
  }, [s.tree, s.currentNodeId])
  const currentNode = currentPath[currentPath.length - 1]
  const previousNode = currentPath.length > 1 ? currentPath[currentPath.length - 2] : null
  const nextNode = currentNode.children[0] ?? null

  const lastMove = currentNode.move ? moveFromICCS(currentNode.move) : null
  const atRoot = currentNode.id === s.tree.root.id

  if (s.loading) return <p className="text-sm text-gray-500">加载中…</p>

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-6">
      <div className="w-full max-w-xl self-center lg:self-start">
        <section className="rounded-lg border border-amber-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-amber-900">变着树</h2>
            <span className="text-xs text-gray-500">点一步看批注</span>
          </div>
          <VariationTree tree={s.tree} currentNodeId={s.currentNodeId} onSelect={s.goto} compact />
          <div className="mt-3 border-t border-amber-100 pt-3">
            <ViewerBoard
              pos={pos}
              lastMove={lastMove}
              moveColor={pos.turn}
              onMove={s.playMove}
              initialFlipped={initialFlipped}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="rounded-md border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
              onClick={() => previousNode && s.goto(previousNode.id)}
              disabled={!previousNode}
              type="button"
            >
              上一步
            </button>
            <button
              className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-40"
              onClick={() => nextNode && s.goto(nextNode.id)}
              disabled={!nextNode}
              type="button"
            >
              下一步
            </button>
          </div>
        </section>
      </div>
      <div className="flex w-full flex-col gap-3 lg:w-80 lg:gap-4">
        <div className="rounded-lg border border-amber-200 bg-white p-4">
          {qipu && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-950">{qipu.title}</p>
              <p className="mt-1 leading-5 text-gray-700">{qipu.summary}</p>
              {qipu.source && (
                <a
                  className="mt-2 inline-block text-xs font-medium text-amber-800 hover:text-amber-950"
                  href={qipu.source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  来源参考：{qipu.source.title}
                </a>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-amber-200 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none"
              placeholder="推演标题"
              value={s.title}
              onChange={(e) => s.setTitle(e.target.value)}
            />
            <button
              className="rounded-md bg-amber-700 px-3 py-1 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-40"
              onClick={() => void onSave()}
              disabled={s.saving || !s.dirty}
            >
              {s.saving ? '保存中…' : s.dirty ? (s.persisted ? '更新推演' : '保存推演') : '已保存'}
            </button>
          </div>
          {s.error && <p className="mt-1 text-xs text-red-600">{s.error}</p>}
          {!id && continuable.length > 0 && (
            <div className="mt-3 border-t border-amber-100 pt-3">
              <p className="mb-2 text-xs font-medium text-amber-900">从已有推演继续</p>
              <div className="flex flex-col gap-1.5">
                {continuable.map((e) => (
                  <Link
                    key={e.id}
                    to={`/explore/${e.id}`}
                    className="rounded-md border border-amber-200 px-2 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
                  >
                    <span className="block truncate">{e.title || '未命名推演'}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(e.updatedAt).toLocaleString()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-md border border-amber-300 px-3 py-1 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-40"
              onClick={() => s.promote(s.currentNodeId)}
              disabled={atRoot}
            >
              设为主线
            </button>
            <button
              className="rounded-md border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
              onClick={() => s.deleteSubtree(s.currentNodeId)}
              disabled={atRoot}
            >
              删除分支
            </button>
          </div>
          <div className="mt-3 border-t border-amber-100 pt-3">
            <label className="mb-2 flex items-center gap-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={saveBranch}
                onChange={(e) => setSaveBranch(e.target.checked)}
                className="h-4 w-4 accent-amber-700"
              />
              保存续战为新分支
            </label>
            <button
              className="w-full rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-40"
              onClick={() => void continueVsAI()}
              disabled={s.saving}
            >
              {s.saving ? '保存中…' : '继续人机对战'}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">批注</h2>
          {currentNode.note.trim() ? (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">
                {atRoot ? '起点说明' : '当前着法批注'}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-950">
                {currentNode.note}
              </p>
            </div>
          ) : (
            <p className="mb-3 rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
              当前节点没有批注。
            </p>
          )}
          <NoteEditor
            note={currentNode.note}
            onChange={(note) => s.setNote(s.currentNodeId, note)}
          />
        </div>
      </div>
    </div>
  )
}
