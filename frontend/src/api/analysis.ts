import { useEffect, useRef, useState } from 'react'
import { authToken } from '../auth'
import type { EngineConfig } from './client'
import { apiUrl } from './client'

export interface AnalysisState {
  depth: number
  scoreCp?: number
  scoreMate?: number
  pv?: string[]
  engine?: EngineConfig
  pending: boolean
  error: boolean
}

interface AnalysisEvent {
  depth: number
  scoreCp?: number
  scoreMate?: number
  pv?: string[]
  engine?: EngineConfig
  done?: boolean
}

const idle: AnalysisState = { depth: 0, pending: false, error: false }

export function parseSSEChunk(buffer: string, chunk: string): { events: string[]; rest: string } {
  const input = buffer + chunk
  const events: string[] = []
  const boundary = /\r?\n\r?\n/g
  let start = 0
  for (let match = boundary.exec(input); match; match = boundary.exec(input)) {
    const data = input
      .slice(start, match.index)
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (data) events.push(data)
    start = boundary.lastIndex
  }
  return { events, rest: input.slice(start) }
}

// 带 Bearer token 读取 SSE；fen 变化或卸载时 AbortController 会取消后端搜索。
export function useAnalysis(fen: string | null): AnalysisState {
  const [state, setState] = useState<AnalysisState>(idle)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (!fen) {
      setState(idle)
      return
    }
    setState({ ...idle, pending: true })
    const timer = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller
      void (async () => {
        try {
          const token = authToken()
          const res = await fetch(apiUrl(`/engine/analyze?fen=${encodeURIComponent(fen)}`), {
            headers: token ? { Accept: 'text/event-stream', Authorization: `Bearer ${token}` } : undefined,
            signal: controller.signal,
          })
          if (!res.ok || !res.body) throw new Error(`analysis failed: HTTP ${res.status}`)
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let done = false
          while (!done) {
            const part = await reader.read()
            if (part.done) break
            const parsed = parseSSEChunk(buffer, decoder.decode(part.value, { stream: true }))
            buffer = parsed.rest
            for (const raw of parsed.events) {
              const data = JSON.parse(raw) as AnalysisEvent
              if (data.done) {
                done = true
                setState((current) => ({ ...current, engine: data.engine ?? current.engine, pending: false }))
                break
              }
              setState({
                depth: data.depth,
                scoreCp: data.scoreCp,
                scoreMate: data.scoreMate,
                pv: data.pv,
                engine: data.engine,
                pending: true,
                error: false,
              })
            }
          }
          if (!done) setState((current) => ({ ...current, pending: false, error: current.depth === 0 }))
        } catch {
          if (!controller.signal.aborted) {
            setState((current) => ({ ...current, pending: false, error: current.depth === 0 }))
          }
        }
      })()
    }, 300)
    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [fen])

  return state
}
