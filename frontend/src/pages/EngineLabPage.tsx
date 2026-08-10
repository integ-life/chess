import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  cacheEnginePackage,
  deleteCachedEnginePackages,
  formatBytes,
  hasCachedEnginePackage,
  parseEngineManifest,
  readCachedEngineFile,
  validateEngineMove,
} from '../engineLab'
import type { CachedEnginePackage, EnginePackageManifest } from '../engineLab'
import { START_FEN, fromFEN } from '../chess/fen'
import './EngineLabPage.css'

type EngineState = 'not-downloaded' | 'downloading' | 'deleting' | 'ready' | 'thinking' | 'error'

type EngineWorkerMessage =
  | { type: 'ready'; elapsedMs: number }
  | { type: 'result'; requestId: number; move: string; elapsedMs: number }
  | { type: 'error'; message: string }

interface SearchResult {
  move: string
  elapsedMs: number
}

const MANIFEST_URL = '/engine-lab/manifest.json'

export default function EngineLabPage() {
  const [manifest, setManifest] = useState<EnginePackageManifest | null>(null)
  const [manifestError, setManifestError] = useState('')
  const [engineState, setEngineState] = useState<EngineState>('not-downloaded')
  const [statusMessage, setStatusMessage] = useState('尚未下载引擎文件')
  const [packageCached, setPackageCached] = useState(false)
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null)
  const [fen, setFen] = useState(START_FEN)
  const [depth, setDepth] = useState(3)
  const [result, setResult] = useState<SearchResult | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const workerBlobUrlRef = useRef<string | null>(null)
  const pendingRef = useRef<{ requestId: number; fen: string } | null>(null)
  const nextRequestId = useRef(1)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        if (!('caches' in window)) throw new Error('当前浏览器不支持持久保存引擎文件')
        const response = await fetch(MANIFEST_URL, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(`无法读取引擎体积清单（HTTP ${response.status}）`)
        const parsed = parseEngineManifest(await response.json() as unknown)
        if (controller.signal.aborted) return
        setManifest(parsed)
        const cached = await hasCachedEnginePackage(parsed, window.location.origin)
        if (controller.signal.aborted) return
        setPackageCached(cached)
        if (cached) setStatusMessage('已找到本地引擎缓存，尚未启动 Worker')
        const persisted = await navigator.storage?.persisted?.()
        if (!controller.signal.aborted) setStoragePersisted(persisted ?? null)
      } catch (error) {
        if (controller.signal.aborted) return
        setManifestError(error instanceof Error ? error.message : String(error))
      }
    })()
    return () => controller.abort()
  }, [])

  useEffect(() => () => {
    workerRef.current?.terminate()
    if (workerBlobUrlRef.current) URL.revokeObjectURL(workerBlobUrlRef.current)
  }, [])

  function terminateWorker() {
    workerRef.current?.terminate()
    workerRef.current = null
    pendingRef.current = null
    if (workerBlobUrlRef.current) URL.revokeObjectURL(workerBlobUrlRef.current)
    workerBlobUrlRef.current = null
  }

  function handleWorkerMessage(event: MessageEvent<EngineWorkerMessage>) {
    const message = event.data
    if (message.type === 'error') {
      setEngineState('error')
      setStatusMessage(message.message)
      return
    }
    if (message.type === 'ready') {
      setEngineState('ready')
      setStatusMessage(`引擎已从本地缓存启动（${Math.round(message.elapsedMs)} ms）`)
      return
    }

    const pending = pendingRef.current
    if (!pending || pending.requestId !== message.requestId) return
    try {
      validateEngineMove(pending.fen, message.move)
      setResult({ move: message.move, elapsedMs: message.elapsedMs })
      setEngineState('ready')
      setStatusMessage('着法已通过前端规则内核的合法性检查')
    } catch (error) {
      setEngineState('error')
      setStatusMessage(error instanceof Error ? error.message : String(error))
    } finally {
      pendingRef.current = null
    }
  }

  async function startWorkerFromCache(cachedPackage: CachedEnginePackage) {
    const workerSource = await (await readCachedEngineFile(cachedPackage, 'worker.js')).text()
    const workerBlobUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
    const worker = new Worker(workerBlobUrl, { type: 'module', name: 'elephant-eye-wasm' })
    workerBlobUrlRef.current = workerBlobUrl
    worker.onmessage = handleWorkerMessage
    worker.onerror = (event) => {
      setEngineState('error')
      setStatusMessage(event.message || '浏览器引擎加载失败')
    }
    workerRef.current = worker
    worker.postMessage({ type: 'init', cacheName: cachedPackage.cacheName, assetUrls: cachedPackage.assetUrls })
  }

  async function downloadAndStart() {
    if (!manifest || workerRef.current) return
    setEngineState('downloading')
    setStatusMessage(packageCached ? '正在校验本地引擎缓存…' : `准备缓存 ${formatBytes(manifest.totalBytes)} 引擎文件…`)
    try {
      const persisted = await navigator.storage?.persisted?.()
      const granted = persisted || await navigator.storage?.persist?.()
      setStoragePersisted(granted ?? null)
      const cachedPackage = await cacheEnginePackage(
        manifest,
        window.location.origin,
        (file) => setStatusMessage(`正在从 GitHub Pages 下载并缓存 ${file.name}…`),
      )
      setPackageCached(true)
      setStatusMessage('引擎文件已缓存，正在启动 Worker…')
      await startWorkerFromCache(cachedPackage)
    } catch (error) {
      setEngineState('not-downloaded')
      setStatusMessage(error instanceof Error ? error.message : String(error))
      setPackageCached(await hasCachedEnginePackage(manifest, window.location.origin).catch(() => false))
    }
  }

  function search() {
    const worker = workerRef.current
    if (!worker || engineState !== 'ready') return
    try {
      fromFEN(fen)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error))
      return
    }

    const requestId = nextRequestId.current++
    pendingRef.current = { requestId, fen }
    setResult(null)
    setEngineState('thinking')
    setStatusMessage(`浏览器 Worker 正在搜索深度 ${depth}…`)
    worker.postMessage({ type: 'search', requestId, fen, depth })
  }

  function stopAndRelease() {
    terminateWorker()
    setResult(null)
    setEngineState('not-downloaded')
    setStatusMessage('Worker 已停止，32 MiB 运行内存已释放；引擎文件仍保存在浏览器中')
  }

  async function deleteLocalEngine() {
    setEngineState('deleting')
    setStatusMessage('正在删除浏览器中的引擎文件…')
    terminateWorker()
    setResult(null)
    try {
      await deleteCachedEnginePackages()
      setPackageCached(false)
      setEngineState('not-downloaded')
      setStatusMessage('本地引擎文件已删除；下次启动前会再次显示并下载完整体积')
    } catch (error) {
      setEngineState('error')
      setStatusMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const packageReady = manifest !== null
  const engineReady = engineState === 'ready'
  const actionIdle = engineState === 'not-downloaded'

  return (
    <main className="engine-lab-page">
      <div className="engine-lab-frame">
        <header className="engine-lab-header">
          <div>
            <p className="engine-lab-eyebrow">隐藏实验 · 不影响现有 AI</p>
            <h1>浏览器引擎试验台</h1>
            <p className="engine-lab-intro">
              把 ElephantEye 放进独立 Worker，在你的设备上计算。打开本页不会下载引擎；只有你确认体积并点击后才会缓存到浏览器。
            </p>
          </div>
          <Link className="engine-lab-back" to="/">返回象棋应用</Link>
        </header>

        <section className="engine-lab-grid" aria-label="浏览器引擎实验">
          <article className="engine-lab-card engine-lab-package-card">
            <div className="engine-lab-card-heading">
              <div>
                <p className="engine-lab-kicker">01 · 下载确认</p>
                <h2>先看清体积，再决定是否启动</h2>
              </div>
              <span className="engine-lab-hosting">GitHub Pages</span>
            </div>

            {manifestError ? (
              <div className="engine-lab-alert" role="alert">
                无法确认下载体积，已禁止启动：{manifestError}
              </div>
            ) : !manifest ? (
              <div className="engine-lab-skeleton" aria-live="polite">正在读取小型体积清单…</div>
            ) : (
              <>
                <div className="engine-lab-size-row">
                  <div>
                    <span>首次引擎下载</span>
                    <strong>{formatBytes(manifest.totalBytes)}</strong>
                    <small>{manifest.totalBytes.toLocaleString()} bytes，实际网络传输可能因压缩更小</small>
                  </div>
                  <div>
                    <span>运行内存</span>
                    <strong>{formatBytes(manifest.runtimeMemoryBytes)}</strong>
                    <small>停止 Worker 后释放，不影响文件缓存</small>
                  </div>
                </div>

                <ul className="engine-lab-files" aria-label="下载文件明细">
                  {manifest.files.map((file) => (
                    <li key={file.name}>
                      <code>{file.name}</code>
                      <span>{formatBytes(file.bytes)}</span>
                    </li>
                  ))}
                </ul>

                <div className="engine-lab-boundary">
                  <strong>流量边界</strong>
                  <p>
                    文件由 <code>chess.integ.life</code> 的 GitHub Pages 静态站点提供，不经过你的后端 server，也不会请求 <code>/api</code>。
                  </p>
                </div>

                <div className={`engine-lab-cache-state${packageCached ? ' engine-lab-cache-state--saved' : ''}`}>
                  <strong>{packageCached ? '引擎文件已保存在浏览器' : '引擎文件尚未缓存'}</strong>
                  <span>
                    {storagePersisted === true
                      ? '持久存储已启用；正常情况下浏览器不会自动清理。'
                      : storagePersisted === false
                        ? '浏览器尚未授予持久存储；启动时会再次申请。'
                        : '启动时将申请持久存储，并写入独立 Cache Storage。'}
                  </span>
                </div>
              </>
            )}

            <button
              className="engine-lab-primary"
              disabled={!packageReady || !actionIdle}
              onClick={() => void downloadAndStart()}
              type="button"
            >
              {manifest
                ? packageCached
                  ? '使用已缓存的本地 AI'
                  : `下载 ${formatBytes(manifest.totalBytes)}、缓存并启动`
                : '等待体积确认'}
            </button>
            <p className="engine-lab-consent-note">
              {packageCached ? '再次启动直接读取本地缓存，不产生引擎下载流量。' : '点击即表示现在开始下载；页面不会替你自动确认。'}
            </p>
            <button
              className="engine-lab-delete"
              disabled={!packageCached || engineState === 'deleting'}
              onClick={() => void deleteLocalEngine()}
              type="button"
            >
              删除本地引擎文件
            </button>
            <p className="engine-lab-delete-note">只有此操作会删除应用管理的引擎缓存；浏览器“清除站点数据”也会删除。</p>
          </article>

          <article className="engine-lab-card engine-lab-run-card">
            <div className="engine-lab-card-heading">
              <div>
                <p className="engine-lab-kicker">02 · 本地验证</p>
                <h2>让 Worker 计算一着</h2>
              </div>
              <span className={`engine-lab-status-dot engine-lab-status-dot--${engineState}`} aria-hidden="true" />
            </div>

            <p className="engine-lab-status" aria-live="polite">{statusMessage}</p>

            <label className="engine-lab-field">
              <span>测试局面 FEN</span>
              <textarea disabled={!engineReady} onChange={(event) => setFen(event.target.value)} rows={4} value={fen} />
            </label>

            <label className="engine-lab-field engine-lab-depth">
              <span>搜索深度</span>
              <select disabled={!engineReady} onChange={(event) => setDepth(Number(event.target.value))} value={depth}>
                {[2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>深度 {value}</option>)}
              </select>
            </label>

            <div className="engine-lab-actions">
              <button className="engine-lab-secondary" disabled={!engineReady} onClick={search} type="button">
                {engineState === 'thinking' ? '计算中…' : '测试当前局面'}
              </button>
              <button
                className="engine-lab-tertiary"
                disabled={!workerRef.current}
                onClick={stopAndRelease}
                type="button"
              >
                停止并释放内存
              </button>
            </div>

            {result && (
              <div className="engine-lab-result">
                <span>合法着法</span>
                <strong>{result.move}</strong>
                <small>{Math.round(result.elapsedMs)} ms · 已由前端规则内核复核</small>
              </div>
            )}
          </article>
        </section>

        <footer className="engine-lab-footer">
          <span>ElephantEye 3.15 · LGPL-2.1 · 当前实验不含开局库</span>
          {manifest && <a href={manifest.sourceUrl} rel="noreferrer" target="_blank">查看上游源码</a>}
        </footer>
      </div>
    </main>
  )
}
