import catalogData from './catalog-data.json'
import type { QipuRecord } from './format'

export interface CatalogGame {
  id: string
  title: string
  collection: string
  event: string
  playedAt: string
  redPlayer: string
  blackPlayer: string
  result: string
  opening: string
  initialFen: string
  moves: string[]
  sourceName: string
  sourceUrl: string
}

export interface CatalogCategory {
  name: string
  gameCount: number
  collections: { name: string; gameCount: number }[]
  games: CatalogGame[]
}

export const qipuCatalog = catalogData as {
  generatedAt: string
  totalGames: number
  categories: CatalogCategory[]
}

export const catalogQipuRecords: QipuRecord[] = qipuCatalog.categories.flatMap((category) =>
  category.games.map((game) => ({
    format: 'xiangqi-study-v1',
    id: `canonical-${game.id}`,
    title: game.title,
    rootFen: game.initialFen,
    summary: [game.redPlayer && game.blackPlayer ? `${game.redPlayer} 对 ${game.blackPlayer}` : '', game.opening]
      .filter(Boolean)
      .join(' · ') || `${category.name} · ${game.collection}`,
    tags: [category.name, game.collection, game.opening].filter(Boolean),
    source: game.sourceUrl ? { title: game.sourceName, url: game.sourceUrl } : undefined,
    line: game.moves.map((move) => ({ move })),
  })),
)
