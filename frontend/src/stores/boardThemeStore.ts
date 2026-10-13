import { create } from 'zustand'

export const BOARD_THEMES = [
  { id: 'classic' },
  { id: 'rosewood' },
  { id: 'neon' },
  { id: 'starlight' },
] as const

export type BoardTheme = (typeof BOARD_THEMES)[number]['id']

const storageKey = 'chess.board.theme'

function isBoardTheme(value: string | null): value is BoardTheme {
  return BOARD_THEMES.some((theme) => theme.id === value)
}

export function normalizeBoardTheme(value: string | null): BoardTheme {
  return isBoardTheme(value) ? value : 'classic'
}

function savedTheme(): BoardTheme {
  if (typeof localStorage === 'undefined') return 'classic'
  return normalizeBoardTheme(localStorage.getItem(storageKey))
}

interface BoardThemeState {
  theme: BoardTheme
  setTheme: (theme: BoardTheme) => void
}

export const useBoardThemeStore = create<BoardThemeState>((set) => ({
  theme: savedTheme(),
  setTheme: (theme) => {
    localStorage.setItem(storageKey, theme)
    set({ theme })
  },
}))
