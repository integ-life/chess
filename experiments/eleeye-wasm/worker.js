let enginePromise
let packageConfig

async function cachedResponse(name) {
  if (!packageConfig) throw new Error('缺少本地引擎缓存配置')
  const assetUrl = packageConfig.assetUrls[name]
  if (!assetUrl) throw new Error(`体积清单缺少 ${name}`)
  const cache = await caches.open(packageConfig.cacheName)
  const response = await cache.match(assetUrl)
  if (!response) throw new Error(`本地缓存缺少 ${name}`)
  return response
}

async function loadEngine() {
  if (!enginePromise) {
    enginePromise = Promise.all([cachedResponse('eleeye.js'), cachedResponse('eleeye.wasm')]).then(
      async ([loaderResponse, wasmResponse]) => {
        const loaderUrl = URL.createObjectURL(await loaderResponse.blob())
        const wasmUrl = URL.createObjectURL(await wasmResponse.blob())
        const { default: createEleeyeModule } = await import(loaderUrl)
        const module = await createEleeyeModule({ locateFile: () => wasmUrl })
        const init = module.cwrap('eleeye_init', 'number', [])
        const bestMove = module.cwrap('eleeye_bestmove', 'string', ['string', 'number'])
        if (init() !== 1) throw new Error('引擎初始化失败')
        return { bestMove }
      },
    )
  }
  return enginePromise
}

self.onmessage = async ({ data }) => {
  try {
    const startedAt = performance.now()
    if (data.type === 'init') {
      packageConfig = { cacheName: data.cacheName, assetUrls: data.assetUrls }
      await loadEngine()
      self.postMessage({ type: 'ready', elapsedMs: performance.now() - startedAt })
      return
    }

    const engine = await loadEngine()
    if (data.type === 'search') {
      const move = engine.bestMove(data.fen, data.depth)
      if (!move) throw new Error('当前局面没有可返回的着法')
      self.postMessage({ type: 'result', requestId: data.requestId, move, elapsedMs: performance.now() - startedAt })
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
