import { describe, expect, it } from 'vitest'
import { START_FEN } from './chess/fen'
import {
  engineAssetUrls,
  engineCacheName,
  formatBytes,
  parseEngineManifest,
  validateEngineMove,
} from './engineLab'

const manifest = {
  name: 'ElephantEye 3.15 WebAssembly',
  version: 'test-version',
  hosting: 'GitHub Pages',
  license: 'LGPL-2.1',
  sourceUrl: 'https://github.com/xqbase/eleeye',
  totalBytes: 60322,
  runtimeMemoryBytes: 33554432,
  files: [
    { name: 'worker.js', bytes: 2043 },
    { name: 'eleeye.js', bytes: 9850 },
    { name: 'eleeye.wasm', bytes: 48429 },
  ],
} as const

describe('browser engine download boundary', () => {
  it('shows human-readable package and runtime sizes', () => {
    expect(formatBytes(60322)).toBe('58.9 KiB')
    expect(formatBytes(33554432)).toBe('32.0 MiB')
  })

  it('accepts only a GitHub Pages manifest with an exact file total', () => {
    expect(parseEngineManifest(manifest).hosting).toBe('GitHub Pages')
    expect(() => parseEngineManifest({ ...manifest, totalBytes: 1 })).toThrow('合计不一致')
    expect(() => parseEngineManifest({ ...manifest, hosting: 'backend' })).toThrow('缺少必要字段')
  })

  it('accepts a legal engine move and rejects an illegal one', () => {
    expect(validateEngineMove(START_FEN, 'c3c4')).toBe('c3c4')
    expect(() => validateEngineMove(START_FEN, 'a0a9')).toThrow('非法着法')
  })

  it('uses a versioned, same-origin persistent cache key', () => {
    const parsed = parseEngineManifest(manifest)
    expect(engineCacheName(parsed)).toBe('chess-browser-engine:test-version')
    expect(engineAssetUrls(parsed, 'https://chess.integ.life')['eleeye.wasm']).toBe(
      'https://chess.integ.life/engine-lab/eleeye.wasm?v=test-version',
    )
  })
})
