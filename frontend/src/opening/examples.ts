import examplesData from './examples-data.json'
import type { QipuRecord } from '../qipu/format'

export interface CourseExample {
  id: string
  title: string
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

export const courseExamples = examplesData as Record<string, CourseExample>

export const courseExampleQipuRecords: QipuRecord[] = Object.values(courseExamples).map((game) => ({
  format: 'xiangqi-study-v1',
  id: `canonical-${game.id}`,
  title: game.title,
  rootFen: game.initialFen,
  summary: `${game.redPlayer} 对 ${game.blackPlayer} · ${game.opening}`,
  tags: ['课程实战', game.opening, game.event].filter(Boolean),
  source: game.sourceUrl ? { title: game.sourceName, url: game.sourceUrl } : undefined,
  note: `本局来自本地 canonical games 数据集，结果 ${game.result}，共 ${game.moves.length} 个半回合。`,
  line: game.moves.map((move) => ({ move })),
}))
