import { describe, expect, it } from 'vitest'
import { normalizeBoardTheme } from './boardThemeStore'

describe('normalizeBoardTheme', () => {
  it('keeps known themes and falls back to classic', () => {
    expect(normalizeBoardTheme('neon')).toBe('neon')
    expect(normalizeBoardTheme('unknown')).toBe('classic')
    expect(normalizeBoardTheme(null)).toBe('classic')
  })
})
