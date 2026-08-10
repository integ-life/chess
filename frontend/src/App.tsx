import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { initSync, syncNow, useSyncStore } from './offline/syncQueue'
import { loadCurrentUser, logout, useAuthStore } from './auth'
import LoginPage from './pages/LoginPage'
import { latestChangelog } from './changelog'
import { BOARD_THEMES, useBoardThemeStore } from './stores/boardThemeStore'
import type { BoardTheme } from './stores/boardThemeStore'
import { LanguagePicker, useI18n } from './i18n'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `app-nav-link min-h-11 px-3 py-1.5 rounded-md text-sm font-medium ${
    isActive ? 'bg-amber-700 text-white' : 'text-amber-900 hover:bg-amber-200'
  }`

function BoardThemePicker() {
  const { t } = useI18n()
  const theme = useBoardThemeStore((state) => state.theme)
  const setTheme = useBoardThemeStore((state) => state.setTheme)
  const current = BOARD_THEMES.find((item) => item.id === theme) ?? BOARD_THEMES[0]

  return (
    <label className="board-theme-picker" title={current.description}>
      <span className="board-theme-picker__label">{t('theme')}</span>
      <select
        aria-label={t('themeAria')}
        className="board-theme-picker__select"
        onChange={(event) => setTheme(event.target.value as BoardTheme)}
        value={theme}
      >
        {BOARD_THEMES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function App() {
  const { t } = useI18n()
  const theme = useBoardThemeStore((state) => state.theme)
  const { online, syncing } = useSyncStore()
  const { ready, user } = useAuthStore()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showChangelogNotice, setShowChangelogNotice] = useState(false)

  useEffect(() => {
    void loadCurrentUser().then(initSync)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.boardTheme = theme
  }, [theme])

  useEffect(() => {
    if (user) void syncNow()
  }, [user])

  useEffect(() => {
    if (!user) return
    setShowChangelogNotice(localStorage.getItem('chess.changelog.seen') !== latestChangelog.version)
  }, [user])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstallPrompt(null)

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return
    const prompt = installPrompt
    setInstallPrompt(null)
    await prompt.prompt()
    await prompt.userChoice.catch(() => undefined)
  }

  function dismissChangelogNotice() {
    localStorage.setItem('chess.changelog.seen', latestChangelog.version)
    setShowChangelogNotice(false)
  }

  if (!ready) {
    return <div className={`app-shell app-shell--${theme} min-h-screen`} />
  }

  if (!user) {
    return (
      <div className={`app-shell app-shell--${theme} min-h-screen px-4 py-6`}>
        <div className="app-login-theme">
          <BoardThemePicker /> <LanguagePicker />
        </div>
        <LoginPage />
      </div>
    )
  }

  return (
    <div className={`app-shell app-shell--${theme} min-h-screen`}>
      <header className="app-header border-b border-amber-200 bg-amber-100">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img alt="" className="h-9 w-9 rounded-lg shadow-sm" src="/favicon.svg" />
            <h1 className="app-brand text-lg font-bold text-amber-900">{t('appName')}</h1>
          </div>
          <nav className="flex gap-1">
            <NavLink to="/" className={navClass} end>
              {t('library')}
            </NavLink>
            <NavLink to="/course" className={navClass}>
              {t('courses')}
            </NavLink>
            <NavLink to="/play" className={navClass}>
              {t('play')}
            </NavLink>
            <NavLink to="/explore" className={navClass}>
              {t('explore')}
            </NavLink>
            <NavLink to="/changelog" className={navClass}>
              {t('updates')}
            </NavLink>
          </nav>
          <BoardThemePicker />
          <LanguagePicker />
          {installPrompt && (
            <button
              className="min-h-11 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white transition-transform duration-150 ease-out hover:bg-amber-800 active:scale-[0.96]"
              onClick={installApp}
              type="button"
            >
              {t('install')}
            </button>
          )}
          <span className="ml-auto text-xs font-medium text-amber-900">{user.username}</span>
          <span
            className={`flex items-center gap-1.5 text-xs ${
              online ? 'text-green-700' : 'text-gray-500'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                syncing ? 'animate-pulse bg-amber-500' : online ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            {syncing ? t('syncing') : online ? t('online') : t('offline')}
          </span>
          <button
            className="min-h-11 rounded-md px-3 py-1 text-xs font-medium text-amber-900 transition-transform duration-150 ease-out hover:bg-amber-200 active:scale-[0.96]"
            onClick={() => void logout()}
            type="button"
          >
            {t('logout')}
          </button>
        </div>
      </header>
      {showChangelogNotice && (
        <div className="app-changelog-notice border-b border-amber-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
            <span className="font-medium text-amber-950">{latestChangelog.title}</span>
            <span className="text-gray-600">{latestChangelog.changes[0]}</span>
            <NavLink className="ml-auto font-medium text-amber-800 hover:text-amber-950" to="/changelog">
              {t('viewHistory')}
            </NavLink>
            <button
              className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              onClick={dismissChangelogNotice}
              type="button"
            >
              {t('gotIt')}
            </button>
          </div>
        </div>
      )}
      <main className="app-main mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
