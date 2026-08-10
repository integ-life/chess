import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Exploration, Game } from '../api/client'
import {
  listExplorations,
  listGames,
  removeExploration,
  removeGame,
} from '../offline/repo'
import { useSyncStore } from '../offline/syncQueue'
import QipuResourcesPage from './QipuResourcesPage'
import { useI18n } from '../i18n'

type Tab = 'games' | 'explorations' | 'resources'

export default function LibraryPage() {
  const { locale, t } = useI18n()
  const [tab, setTab] = useState<Tab>('games')
  const [games, setGames] = useState<Game[] | null>(null)
  const [explorations, setExplorations] = useState<Exploration[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    Promise.all([listGames().then(setGames), listExplorations().then(setExplorations)]).catch(
      (e) => setError(String(e)),
    )

  const syncVersion = useSyncStore((s) => s.syncVersion)
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncVersion])

  async function onDelete(kind: Exclude<Tab, 'resources'>, id: string) {
    if (!confirm(kind === 'games' ? t('deleteGameConfirm') : t('deleteExplorationConfirm'))) return
    await (kind === 'games' ? removeGame(id) : removeExploration(id))
    void load()
  }

  const tabClass = (t: Tab) =>
    `px-3 py-1.5 rounded-md text-sm font-medium ${
      tab === t ? 'bg-amber-700 text-white' : 'text-amber-900 hover:bg-amber-200'
    }`

  return (
    <div className={`mx-auto ${tab === 'resources' ? 'max-w-4xl' : 'max-w-2xl'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto">
          <button className={tabClass('games')} onClick={() => setTab('games')}>
            {t('games')}
          </button>
          <button className={tabClass('explorations')} onClick={() => setTab('explorations')}>
            {t('explorations')}
          </button>
          <button className={tabClass('resources')} onClick={() => setTab('resources')}>
            {t('resources')}
          </button>
        </div>
        {tab !== 'resources' && (
          <Link
            to={tab === 'games' ? '/play' : '/explore'}
            className="rounded-md bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
          >
            {tab === 'games' ? t('newGame') : t('newExploration')}
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{t('loadFailed')}: {error}</p>}

      {tab === 'games' && (
        <>
          {games && games.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-white p-8 text-center text-sm text-gray-500">
              {t('noGames')}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {games?.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-4"
              >
                <Link to={`/games/${g.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-amber-900">{g.title || t('untitledGame')}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {g.moves.length} {t('moves')} · {g.result === '*' ? t('unfinished') : g.result} ·{' '}
                    {new Date(g.updatedAt).toLocaleString(locale)}
                  </p>
                </Link>
                <button
                  className="ml-3 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => onDelete('games', g.id)}
                >
                  {t('delete')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'explorations' && (
        <>
          {explorations && explorations.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-white p-8 text-center text-sm text-gray-500">
              {t('noExplorations')}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {explorations?.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-4"
              >
                <Link to={`/explore/${e.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-amber-900">{e.title || t('untitledExploration')}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(e.updatedAt).toLocaleString(locale)}
                  </p>
                </Link>
                <button
                  className="ml-3 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => onDelete('explorations', e.id)}
                >
                  {t('delete')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'resources' && <QipuResourcesPage />}
    </div>
  )
}
