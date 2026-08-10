const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const API_BASE_URL = RAW_API_BASE.replace(/\/$/, '')

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('chess.auth.token')
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(apiUrl(path), {
    ...init,
    headers,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

export interface EngineMoveResponse {
  bestMove: string
  scoreCp?: number
  scoreMate?: number
  pv?: string[]
  engine: EngineConfig
}

export interface EngineConfig {
  name: string
  protocol: string
}

export function requestEngineMove(fen: string, level: number): Promise<EngineMoveResponse> {
  return request('/engine/move', {
    method: 'POST',
    body: JSON.stringify({ fen, level }),
  })
}

export interface Game {
  id: string
  title: string
  redPlayer: string
  blackPlayer: string
  result: string
  initialFen: string
  moves: string[]
  tree?: unknown // VariationTree；对局也使用同一棵可扩展变着树，moves 是主线摘要
  source: string
  isPublic?: boolean
  category?: string
  collection?: string
  opening?: string
  qualityScore?: number
  averageLossCp?: number
  blunderCount?: number
  engineName?: string
  sourceUrl?: string
  analyzedAt?: number
  createdAt: number
  updatedAt: number
  deleted: boolean
}

export function normalizeGame(game: Game): Game {
  const moves = (game as { moves?: unknown }).moves
  return { ...game, moves: Array.isArray(moves) ? moves : [] }
}

export function listGames(): Promise<Game[]> {
  return request<Game[]>('/games').then((rows) => rows.map(normalizeGame))
}

export function listPublicGames(filter: { category?: string; q?: string; sort?: string } = {}): Promise<Game[]> {
  const params = new URLSearchParams()
  if (filter.category) params.set('category', filter.category)
  if (filter.q) params.set('q', filter.q)
  if (filter.sort) params.set('sort', filter.sort)
  const query = params.size ? `?${params}` : ''
  return request<Game[]>(`/games/public${query}`).then((rows) => rows.map(normalizeGame))
}

export function getGame(id: string): Promise<Game> {
  return request<Game>(`/games/${id}`).then(normalizeGame)
}

export function putGame(g: Game): Promise<{ applied: boolean }> {
  const game = normalizeGame(g)
  return request(`/games/${game.id}`, { method: 'PUT', body: JSON.stringify(game) })
}

export function deleteGame(id: string): Promise<{ ok: boolean }> {
  return request(`/games/${id}`, { method: 'DELETE' })
}

export interface Exploration {
  id: string
  title: string
  rootFen: string
  gameId?: string
  tree: unknown // VariationTree（避免循环依赖，由调用方断言；可包含当前继续节点）
  createdAt: number
  updatedAt: number
  deleted: boolean
}

export function listExplorations(): Promise<Exploration[]> {
  return request('/explorations')
}

export function getExploration(id: string): Promise<Exploration> {
  return request(`/explorations/${id}`)
}

export function putExploration(e: Exploration): Promise<{ applied: boolean }> {
  return request(`/explorations/${e.id}`, { method: 'PUT', body: JSON.stringify(e) })
}

export function deleteExploration(id: string): Promise<{ ok: boolean }> {
  return request(`/explorations/${id}`, { method: 'DELETE' })
}

export interface OnlineMatch {
  id: string
  roomCode?: string
  status: 'waiting' | 'active' | 'finished'
  opponentType: 'human' | 'bot'
  botLevel?: number
  botThinking: boolean
  playerColor: 'r' | 'b' | ''
  turn: 'r' | 'b'
  initialFen: string
  fen: string
  moves: string[]
  redPlayer: string
  blackPlayer: string
  redTimeMs: number
  blackTimeMs: number
  incrementMs: number
  waitingUntil?: number
  result: string
  resultReason?: string
}

export interface OnlineTimeControl {
  initialTimeMs: number
  incrementMs: number
}

export function startOnlineMatch(botLevel = 3, timeControl?: OnlineTimeControl): Promise<OnlineMatch> {
  return request('/online/match', {
    method: 'POST',
    body: JSON.stringify({ botLevel, botAfterMs: 8000, ...timeControl }),
  })
}

export function resumeOnlineMatch(): Promise<OnlineMatch | null> {
  return request<OnlineMatch | null>('/online/resume', { method: 'POST' })
}

export function createOnlineRoom(timeControl?: OnlineTimeControl): Promise<OnlineMatch> {
  return request('/online/rooms', { method: 'POST', body: JSON.stringify(timeControl ?? {}) })
}

export function joinOnlineRoom(code: string): Promise<OnlineMatch> {
  return request(`/online/rooms/${encodeURIComponent(code)}/join`, { method: 'POST' })
}

export function getOnlineMatch(id: string): Promise<OnlineMatch> {
  return request(`/online/matches/${id}`)
}

export function cancelOnlineMatch(id: string): Promise<{ ok: boolean }> {
  return request(`/online/matches/${id}/cancel`, { method: 'POST' })
}

export function playOnlineMove(id: string, move: string): Promise<OnlineMatch> {
  return request(`/online/matches/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ move }),
  })
}

export function resignOnlineMatch(id: string): Promise<OnlineMatch> {
  return request(`/online/matches/${id}/resign`, { method: 'POST' })
}
