import { StrictMode, Suspense, createElement, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import LibraryPage from './pages/LibraryPage'
import PlayPage from './pages/PlayPage'
import ViewerPage from './pages/ViewerPage'
import ExplorePage from './pages/ExplorePage'
import ChangelogPage from './pages/ChangelogPage'
import QipuResourcesPage from './pages/QipuResourcesPage'
import { consumeUnifiedLoginCallback } from './auth'
import { MetricsErrorBoundary } from '@integ-life/metrics-web/react'
import { telemetry } from './telemetry'
import { I18nProvider } from './i18n'
declare const __SW_VERSION__: string
declare const __APP_VERSION__: string

interface AppVersionFile {
  version?: string
}

function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  const swUrl = `/chess-pwa-worker.js?v=${__SW_VERSION__}`
  let reloading = false
  let versionCheckPending = false

  const reloadForVersion = async (version: string) => {
    if (reloading) return
    const reloadKey = `chess.version.reloaded.${version}`
    if (sessionStorage.getItem(reloadKey)) return
    sessionStorage.setItem(reloadKey, '1')
    reloading = true

    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
    window.location.reload()
  }

  const checkPublishedVersion = async (registration?: ServiceWorkerRegistration) => {
    if (versionCheckPending) return
    versionCheckPending = true
    try {
      const res = await fetch(`/app-version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) return
      const remote = (await res.json()) as AppVersionFile
      if (!remote.version || remote.version === __APP_VERSION__) return

      const activeRegistration = registration ?? (await navigator.serviceWorker.getRegistration())
      const updatedRegistration = await activeRegistration?.update().catch(() => activeRegistration)
      updatedRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      window.setTimeout(() => void reloadForVersion(remote.version!), 1200)
    } catch (err) {
      console.warn('app version check failed', err)
    } finally {
      versionCheckPending = false
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    if (sessionStorage.getItem('chess.sw.reloaded') === __SW_VERSION__) return
    sessionStorage.setItem('chess.sw.reloaded', __SW_VERSION__)
    reloading = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(swUrl, { updateViaCache: 'none' })
      .then((registration) => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
        window.setInterval(
          () => {
            if (document.visibilityState === 'visible') {
              void registration.update()
              void checkPublishedVersion(registration)
            }
          },
          5 * 60 * 1000,
        )
        window.addEventListener('focus', () => void checkPublishedVersion(registration))
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void checkPublishedVersion(registration)
        })
        void checkPublishedVersion(registration)
      })
      .catch((err: unknown) => {
        console.warn('service worker registration failed', err)
      })
  })
}

consumeUnifiedLoginCallback()
registerAppServiceWorker()

const router = createHashRouter([
  {
    path: '/engine-lab',
    element: createElement(lazy(() => import('./pages/EngineLabPage'))),
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'course', element: createElement(lazy(() => import('./pages/CurriculumPage'))) },
      { path: 'course/foundation', element: createElement(lazy(() => import('./pages/FoundationCoursePage'))) },
      { path: 'course/mates', element: createElement(lazy(() => import('./pages/MatesCoursePage'))) },
      { path: 'course/tactics', element: createElement(lazy(() => import('./pages/TacticsCoursePage'))) },
      { path: 'course/opening', element: createElement(lazy(() => import('./pages/OpeningCoursePage'))) },
      { path: 'course/middlegame', element: createElement(lazy(() => import('./pages/MiddlegameCoursePage'))) },
      { path: 'course/middlegame-plans', element: createElement(lazy(() => import('./pages/MiddlegamePlansCoursePage'))) },
      { path: 'course/endgames', element: createElement(lazy(() => import('./pages/EndgamesCoursePage'))) },
      { path: 'course/practice', element: createElement(lazy(() => import('./pages/PracticeCoursePage'))) },
      { path: 'play', element: <PlayPage /> },
      { path: 'games/:id', element: <ViewerPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'explore/:id', element: <ExplorePage /> },
      { path: 'qipu-resources', element: <QipuResourcesPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
    {telemetry ? <MetricsErrorBoundary client={telemetry} fallback={<main role="alert">Chess encountered an unexpected error. / 国际象棋发生意外错误，请刷新页面。</main>}>
      <Suspense fallback={<div className="min-h-screen bg-amber-50" />}><RouterProvider router={router} /></Suspense>
    </MetricsErrorBoundary> : <Suspense fallback={<div className="min-h-screen bg-amber-50" />}><RouterProvider router={router} /></Suspense>}
    </I18nProvider>
  </StrictMode>,
)
