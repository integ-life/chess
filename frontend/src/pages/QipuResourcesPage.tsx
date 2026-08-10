import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { qipuCatalog } from '../qipu/catalog'
import { learningQipuRecords } from '../qipu/publicQipu'

const categoryOrder = ['开局', '赛事实战', '中局', '残局', '战术题', '精选']

const categoryCopy: Record<string, { eyebrow: string; description: string; study: string }> = {
  开局: {
    eyebrow: '布局体系',
    description: '从标准初始局面出发，按中炮、屏风马、顺炮、列炮、仙人指路等体系整理。',
    study: '先看前 20 个半回合，比较双方出子顺序和转置。',
  },
  赛事实战: {
    eyebrow: '完整对局',
    description: '按赛事和年份整理的完整棋局，适合连续观察棋手的布局选择与中残局处理。',
    study: '选同一赛事或同一开局连续看三盘，记录共同的转折点。',
  },
  中局: {
    eyebrow: '攻防转换',
    description: '聚焦弃子、牵制、兑子、抢先和局面判断，通常从已经形成战斗的局面开始。',
    study: '先遮住后续着法，在推演页写下两个候选着再对照原谱。',
  },
  残局: {
    eyebrow: '胜和技术',
    description: '按车、马、炮、兵卒等子力组合整理实用残局和古典残局。',
    study: '先判断胜、和、负，再寻找最短计划，不急着逐着背诵。',
  },
  战术题: {
    eyebrow: '计算训练',
    description: '短小局面与杀法题，训练将军、捉子、牵制和连续强制着。',
    study: '从将军、吃子和直接威胁开始列候选着，算清对方最强应对。',
  },
  精选: {
    eyebrow: '专题选编',
    description: '来自棋书、专题合集和人工选编的代表棋谱，适合按一个主题集中学习。',
    study: '先读合集主题，再比较代表局为什么被放在同一组。',
  },
}

const sourceLinks = [
  {
    name: 'Vietcotuong Community Database',
    url: 'https://github.com/chasoft/community-xiangqi-games-database',
    note: 'DhtmlXQ 社区库，提供开局、中局、残局、题库、精选与赛事目录。',
  },
  {
    name: 'CGLemon · WXF',
    url: 'https://github.com/CGLemon/chinese-chess-PGN',
    note: '世界象棋联合会 41,743 局 ICCS 棋谱。',
  },
  {
    name: 'CGLemon · 东萍',
    url: 'https://github.com/CGLemon/chinese-chess-PGN',
    note: '东萍棋谱仓库约 99,813 局 ICCS 棋谱。',
  },
]

const courseSourceLinks = [
  { name: 'WXF 校本课程研究', url: 'https://www.wxf-chess.org/images/hangzhou-chess/2022_46_wang_bi_xiao_.pdf', file: 'wxf-school-course.pdf', checksum: '57192d4935cb', note: '课程分级、训练记录与考核；公开论文，仅摘要。' },
  { name: 'WXF Introduction to Chess', url: 'https://www.wxf-chess.org/images/free_download_books/xiangqi_introduction_chessplayers_20150323.pdf', file: 'wxf-xiangqi-introduction.pdf', checksum: 'bae133202d70', note: '规则、开局原则与自测；免费公开教材，仅摘要。' },
  { name: '维基教科书：国际象棋/开局', url: 'https://zh.wikibooks.org/wiki/中國象棋/開局', file: 'wikibooks-opening.html', checksum: 'e15f7a3e8b0c', note: '出子、车路与将帅安全；CC BY-SA 4.0。' },
  { name: 'Chess.com：十个开局原则', url: 'https://www.zh.chess.com/articles/10-xiangqi-opening-principles.html', file: 'xiangqi-opening-principles.html', checksum: '913a42da4358', note: '大子、中心、拥堵与孤军深入；独立改写，不复制正文。' },
  { name: 'Chess.com：新手教程', url: 'https://www.zh.chess.com/how-to-play-chess/', file: 'xiangqi-learning-guide.html', checksum: '715a31db6cd6', note: '棋子职责与开中局转换；独立改写，不复制正文。' },
  { name: 'Chess.com：中炮主流变化', url: 'https://www.zh.chess.com/opening-central-cannon.html', file: 'xiangqi-central-cannon.html', checksum: '4123e12d45db', note: '屏风马、反宫马与顺列炮结构；独立改写。' },
  { name: 'Chess.com：仙人指路', url: 'https://www.zh.chess.com/opening-angels-guide.html', file: 'xiangqi-angel-guide.html', checksum: '340ab4b4dd77', note: '保留选择、卒底炮与转型；独立改写。' },
  { name: '象棋棋谱网：布局体系分类', url: 'https://www.xiangqiqipu.com/Category/View-32159.html', file: 'xiangqiqipu-opening-systems.html', checksum: 'e3a6ecc49403', note: '炮类与弹性体系地图；版权未明，仅本地研究。' },
]

const count = new Intl.NumberFormat('zh-CN')

export default function QipuResourcesPage() {
  const categories = useMemo(
    () => categoryOrder.map((name) => qipuCatalog.categories.find((category) => category.name === name)!).filter(Boolean),
    [],
  )
  const [selectedName, setSelectedName] = useState('开局')
  const selected = categories.find((category) => category.name === selectedName) ?? categories[0]
  const copy = categoryCopy[selected.name]

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_13rem] md:p-7">
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] text-red-800">CANONICAL QIPU CATALOG</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-amber-950 md:text-4xl">公共棋谱目录</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">
              完整棋局按初始局面和 ICCS 着法去重，同一棋局的不同来源仍保留 provenance。
              先按学习类别找棋谱，再进入推演逐着回放。
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-amber-200 bg-amber-200 md:grid-cols-1">
            <div className="bg-amber-50 p-4">
              <dt className="text-sm text-gray-600">canonical games</dt>
              <dd className="mt-1 font-serif text-2xl font-bold tabular-nums text-amber-950">{count.format(qipuCatalog.totalGames)}</dd>
            </div>
            <div className="bg-amber-50 p-4">
              <dt className="text-sm text-gray-600">分类</dt>
              <dd className="mt-1 font-serif text-2xl font-bold tabular-nums text-amber-950">{categories.length}</dd>
            </div>
          </dl>
        </div>
        <p className="border-t border-amber-100 px-5 py-3 text-sm leading-6 text-gray-600 md:px-7">
          当前页面是 {new Date(qipuCatalog.generatedAt).toLocaleDateString('zh-CN')} 的只读目录快照；每类先展示 8 个主要合集和 8 盘代表棋谱。
          完整分页目录将在 dataset 正式同步后接入。
        </p>
      </section>

      <section aria-labelledby="qipu-categories-title">
        <div>
          <p className="text-sm font-medium text-red-800">01 · 选择分类</p>
          <h3 className="mt-1 text-xl font-bold text-amber-950" id="qipu-categories-title">按要练的内容找棋谱</h3>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((category, index) => {
            const active = category.name === selected.name
            return (
              <button
                aria-pressed={active}
                className={`min-h-24 rounded-lg border p-3 text-left ${
                  active
                    ? 'border-amber-800 bg-amber-800 text-white shadow-md'
                    : 'border-amber-200 bg-white text-amber-950 hover:bg-amber-50'
                }`}
                key={category.name}
                onClick={() => setSelectedName(category.name)}
                type="button"
              >
                <span className={`block text-xs tabular-nums ${active ? 'text-amber-100' : 'text-gray-500'}`}>0{index + 1}</span>
                <strong className="mt-2 block text-base">{category.name}</strong>
                <span className={`mt-1 block text-sm tabular-nums ${active ? 'text-amber-100' : 'text-gray-600'}`}>
                  {count.format(category.gameCount)} 盘
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm md:p-6" aria-live="polite">
        <header className="border-b border-amber-100 pb-4">
          <p className="text-sm font-medium text-red-800">02 · {copy.eyebrow}</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-serif text-2xl font-bold text-amber-950">{selected.name}</h3>
              <p className="mt-2 max-w-3xl text-base leading-7 text-gray-700">{copy.description}</p>
            </div>
            <span className="text-lg font-semibold tabular-nums text-amber-900">{count.format(selected.gameCount)} 盘</span>
          </div>
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm leading-6 text-gray-700">学习建议：{copy.study}</p>
        </header>

        <div className="mt-5">
          <h4 className="text-base font-semibold text-amber-950">主要合集</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {selected.collections.map((collection) => (
              <div className="flex items-center justify-between gap-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2" key={collection.name}>
                <span className="min-w-0 break-words text-sm text-gray-700">{collection.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-gray-500">{count.format(collection.gameCount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h4 className="text-base font-semibold text-amber-950">代表棋谱</h4>
            <span className="text-sm text-gray-500">每个主要合集一盘</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {selected.games.map((game) => (
              <article className="flex min-w-0 flex-col rounded-lg border border-amber-200 bg-white p-4" key={game.id}>
                <p className="text-xs font-medium text-red-800">{game.collection}</p>
                <h5 className="mt-1 break-words text-base font-semibold leading-6 text-amber-950">{game.title}</h5>
                <p className="mt-2 text-sm leading-6 text-gray-700">
                  {game.redPlayer && game.blackPlayer ? `${game.redPlayer} 对 ${game.blackPlayer}` : '专题局面'}
                  {' · '}{game.result === '*' ? '结果未录' : game.result}{' · '}{game.moves.length} 着
                </p>
                {game.opening && <p className="mt-1 text-sm leading-6 text-gray-600">{game.opening}</p>}
                {(game.event || game.playedAt) && (
                  <p className="mt-1 text-sm leading-6 text-gray-500">{[game.event, game.playedAt].filter(Boolean).join(' · ')}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                  <Link
                    className="inline-flex min-h-11 items-center rounded-md bg-amber-700 px-3 text-sm font-medium text-white hover:bg-amber-800"
                    to={`/explore?qipu=${encodeURIComponent(`canonical-${game.id}`)}`}
                  >
                    打开棋谱
                  </Link>
                  {game.sourceUrl && (
                    <a
                      className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-amber-800 hover:text-amber-950"
                      href={game.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      查看来源
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <p className="text-sm font-medium text-red-800">03 · 带讲解的学习骨架</p>
        <h3 className="mt-1 text-xl font-bold text-amber-950">从短主线开始练习</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {learningQipuRecords.map((qipu) => (
            <article className="rounded-lg border border-amber-200 bg-white p-4" key={qipu.id}>
              <h4 className="text-base font-semibold text-amber-950">{qipu.title}</h4>
              <p className="mt-2 text-sm leading-6 text-gray-700">{qipu.summary}</p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center rounded-md border border-amber-300 px-3 text-sm font-medium text-amber-900 hover:bg-amber-50"
                to={`/explore?qipu=${encodeURIComponent(qipu.id)}`}
              >
                打开学习谱
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-amber-200 pt-5">
        <h3 className="text-base font-semibold text-amber-950">课程资料来源</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
          本地研究快照由脚本拉取并以 SHA-256 校验；产品课程只做摘要、分类和独立表达，不发布第三方全文。
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {courseSourceLinks.map((source) => (
            <a className="rounded-lg border border-amber-200 bg-white p-3 hover:bg-amber-50" href={source.url} key={source.file} rel="noreferrer" target="_blank">
              <strong className="text-sm text-amber-950">{source.name}</strong>
              <span className="mt-1 block text-sm leading-6 text-gray-600">{source.note}</span>
              <code className="mt-2 block break-all text-xs text-gray-500">{source.file} · sha256:{source.checksum}…</code>
            </a>
          ))}
        </div>
      </section>

      <section className="border-t border-amber-200 pt-5">
        <h3 className="text-base font-semibold text-amber-950">棋谱数据来源</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
          每盘 canonical game 只保存一份，但会继续保留所有来源记录。批量抓取、合法性校验和 Pikafish 分析只在本机运行。
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {sourceLinks.map((source) => (
            <a
              className="min-h-24 rounded-lg border border-amber-200 bg-white p-3 hover:bg-amber-50"
              href={source.url}
              key={source.name}
              rel="noreferrer"
              target="_blank"
            >
              <strong className="text-sm text-amber-950">{source.name}</strong>
              <span className="mt-1 block text-sm leading-6 text-gray-600">{source.note}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
