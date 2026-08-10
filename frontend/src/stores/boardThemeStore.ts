import { create } from 'zustand'

export const BOARD_THEMES = [
  { id: 'classic', name: '经典轻量', description: '清爽耐看，关闭所有装饰动画' },
  { id: 'rosewood', name: '紫檀木雕', description: '立体木纹、浮雕棋子与柔和投影' },
  { id: 'neon', name: '量子霓虹', description: '深空玻璃、青红光轨与能量棋子' },
  { id: 'starlight', name: '星河鎏金', description: '夜空棋台、流金线条与闪耀星尘' },
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
