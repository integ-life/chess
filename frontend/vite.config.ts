import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/'
const swVersion = process.env.SW_VERSION ?? new Date().toISOString().replace(/[-:.TZ]/g, '')
const buildTime = process.env.BUILD_TIME ?? new Date().toISOString()
const appVersion = process.env.APP_VERSION ?? swVersion

// https://vite.dev/config/
export default defineConfig({
  base,
  define: {
    __SW_VERSION__: JSON.stringify(swVersion),
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    {
      name: 'emit-app-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'app-version.json',
          source: `${JSON.stringify({ version: appVersion, swVersion, buildTime })}\n`,
        })
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      filename: 'chess-pwa-worker.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: '国际象棋',
        short_name: '象棋',
        description: '国际象棋学习：对战、推演、打谱',
        lang: 'zh-CN',
        theme_color: '#b45309',
        background_color: '#fffbeb',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Browser engine assets require explicit size consent and must never be silently precached.
        globIgnores: ['**/app-version.json', '**/engine-lab/**'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // 数据走 IndexedDB（本地优先），SW 只负责离线可用的 app shell；
        // /api/* 一律不缓存，离线时推演和批注继续使用本地库。
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/app-version.json'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
