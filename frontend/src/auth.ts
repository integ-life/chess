import { create } from 'zustand'
import { ApiError, apiUrl, request } from './api/client'
import { clearLocalData } from './offline/db'

export interface AuthUser {
  id: number
  username: string
  createdAt: number
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  ready: boolean
  setSession: (token: string, user: AuthUser) => void
  clearSession: () => void
}

const tokenKey = 'chess.auth.token'
const unifiedLoginMarker = 'chess.auth.unified-login'
const unifiedLoginErrorKey = 'chess.auth.unified-login-error'

function tokenStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export const useAuthStore = create<AuthState>((set) => ({
  token: tokenStorage()?.getItem(tokenKey) ?? null,
  user: null,
  ready: false,
  setSession: (token, user) => {
    tokenStorage()?.setItem(tokenKey, token)
    set({ token, user, ready: true })
  },
  clearSession: () => {
    tokenStorage()?.removeItem(tokenKey)
    set({ token: null, user: null, ready: true })
  },
}))

interface AuthResponse {
  token: string
  expiresAt: number
  user: AuthUser
}

export function authToken(): string | null {
  return useAuthStore.getState().token
}

export async function loadCurrentUser(): Promise<void> {
  const token = authToken()
  if (!token) {
    useAuthStore.setState({ ready: true, user: null })
    return
  }
  try {
    if (sessionStorage.getItem(unifiedLoginMarker)) {
      await clearLocalData()
      sessionStorage.removeItem(unifiedLoginMarker)
    }
    const user = await request<AuthUser>('/auth/me')
    useAuthStore.setState({ user, ready: true })
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await clearLocalData()
      useAuthStore.getState().clearSession()
      return
    }
    useAuthStore.setState({ ready: true })
  }
}

export async function login(username: string, password: string): Promise<void> {
  const res = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  await clearLocalData()
  useAuthStore.getState().setSession(res.token, res.user)
}

export async function register(username: string, password: string): Promise<void> {
  const res = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  await clearLocalData()
  useAuthStore.getState().setSession(res.token, res.user)
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' }).catch(() => undefined)
  await clearLocalData()
  useAuthStore.getState().clearSession()
}

export function startUnifiedLogin(): void {
  window.location.assign(apiUrl('/auth/integ/start'))
}

export function parseUnifiedLoginFragment(fragment: string): { token?: string; error?: string } | null {
  const query = fragment.startsWith('#/?') ? fragment.slice(3) : ''
  if (!query) return null
  const values = new URLSearchParams(query)
  const token = values.get('token')?.trim()
  const error = values.get('auth_error')?.trim()
  if (!token && !error) return null
  return { ...(token ? { token } : {}), ...(error ? { error } : {}) }
}

export function consumeUnifiedLoginCallback(): void {
  const result = parseUnifiedLoginFragment(window.location.hash)
  if (!result) return
  if (result.token) {
    tokenStorage()?.setItem(tokenKey, result.token)
    sessionStorage.setItem(unifiedLoginMarker, '1')
    useAuthStore.setState({ token: result.token, user: null, ready: false })
  }
  if (result.error) sessionStorage.setItem(unifiedLoginErrorKey, result.error)
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`)
}

export function consumeUnifiedLoginError(): string | null {
  const error = sessionStorage.getItem(unifiedLoginErrorKey)
  sessionStorage.removeItem(unifiedLoginErrorKey)
  return error
}
