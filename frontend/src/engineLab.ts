import { fromFEN } from './chess/fen'
import { moveFromICCS } from './chess/notation'
import { isLegal } from './chess/position'

export interface EnginePackageFile {
  name: string
  bytes: number
}

export interface EnginePackageManifest {
  name: string
  version: string
  hosting: 'GitHub Pages'
  license: string
  sourceUrl: string
  totalBytes: number
  runtimeMemoryBytes: number
  files: EnginePackageFile[]
}

export interface CachedEnginePackage {
  cacheName: string
  assetUrls: Record<string, string>
}

export const ENGINE_CACHE_PREFIX = 'chess-browser-engine:'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function parseEngineManifest(value: unknown): EnginePackageManifest {
  if (!value || typeof value !== 'object') throw new Error('引擎体积清单格式无效')
  const manifest = value as Partial<EnginePackageManifest>
  if (
    typeof manifest.name !== 'string' ||
    typeof manifest.version !== 'string' ||
    manifest.hosting !== 'GitHub Pages' ||
    typeof manifest.license !== 'string' ||
    typeof manifest.sourceUrl !== 'string' ||
    !Number.isSafeInteger(manifest.totalBytes) ||
    !Number.isSafeInteger(manifest.runtimeMemoryBytes) ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error('引擎体积清单缺少必要字段')
  }

  const files = manifest.files.map((file) => {
    if (
      !file ||
      typeof file !== 'object' ||
      typeof file.name !== 'string' ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0
    ) {
      throw new Error('引擎文件体积无效')
    }
    return { name: file.name, bytes: file.bytes }
  })
  const totalBytes = manifest.totalBytes as number
  if (files.reduce((sum, file) => sum + file.bytes, 0) !== totalBytes) {
    throw new Error('引擎体积清单合计不一致')
  }

  return { ...(manifest as EnginePackageManifest), totalBytes, files }
}

export function validateEngineMove(fen: string, iccs: string): string {
  const position = fromFEN(fen)
  const move = moveFromICCS(iccs)
  if (!isLegal(position, move)) throw new Error(`引擎返回非法着法 ${iccs}`)
  return iccs
}

export function engineCacheName(manifest: EnginePackageManifest): string {
  return `${ENGINE_CACHE_PREFIX}${manifest.version}`
}

export function engineAssetUrls(manifest: EnginePackageManifest, origin: string): Record<string, string> {
  return Object.fromEntries(
    manifest.files.map((file) => {
      const url = new URL(`/engine-lab/${file.name}`, origin)
      url.searchParams.set('v', manifest.version)
      return [file.name, url.href]
    }),
  )
}

async function responseHasSize(response: Response | undefined, bytes: number): Promise<boolean> {
  if (!response) return false
  return (await response.clone().arrayBuffer()).byteLength === bytes
}

export async function hasCachedEnginePackage(
  manifest: EnginePackageManifest,
  origin: string,
  storage: CacheStorage = caches,
): Promise<boolean> {
  const cacheName = engineCacheName(manifest)
  if (!(await storage.keys()).includes(cacheName)) return false
  const cache = await storage.open(cacheName)
  const urls = engineAssetUrls(manifest, origin)
  const matches = await Promise.all(
    manifest.files.map(async (file) => responseHasSize(await cache.match(urls[file.name]), file.bytes)),
  )
  return matches.every(Boolean)
}

export async function cacheEnginePackage(
  manifest: EnginePackageManifest,
  origin: string,
  onProgress: (file: EnginePackageFile) => void,
  storage: CacheStorage = caches,
  fetcher: typeof fetch = fetch,
): Promise<CachedEnginePackage> {
  const cacheName = engineCacheName(manifest)
  const assetUrls = engineAssetUrls(manifest, origin)
  if (await hasCachedEnginePackage(manifest, origin, storage)) return { cacheName, assetUrls }

  await storage.delete(cacheName)
  const cache = await storage.open(cacheName)
  try {
    for (const file of manifest.files) {
      onProgress(file)
      const response = await fetcher(assetUrls[file.name], { cache: 'no-store' })
      if (!response.ok) throw new Error(`下载 ${file.name} 失败（HTTP ${response.status}）`)
      if (!(await responseHasSize(response, file.bytes))) {
        throw new Error(`${file.name} 下载体积与清单不一致`)
      }
      await cache.put(assetUrls[file.name], response.clone())
    }
  } catch (error) {
    await storage.delete(cacheName)
    throw error
  }
  return { cacheName, assetUrls }
}

export async function readCachedEngineFile(
  cachedPackage: CachedEnginePackage,
  name: string,
  storage: CacheStorage = caches,
): Promise<Response> {
  const url = cachedPackage.assetUrls[name]
  if (!url) throw new Error(`本地引擎缓存缺少 ${name}`)
  const response = await (await storage.open(cachedPackage.cacheName)).match(url)
  if (!response) throw new Error(`本地引擎缓存缺少 ${name}`)
  return response
}

export async function deleteCachedEnginePackages(storage: CacheStorage = caches): Promise<void> {
  const cacheNames = await storage.keys()
  await Promise.all(cacheNames.filter((name) => name.startsWith(ENGINE_CACHE_PREFIX)).map((name) => storage.delete(name)))
}
