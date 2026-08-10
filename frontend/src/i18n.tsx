import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const languages = [
  { code: 'zh-CN', name: '中文' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
] as const

export type Locale = (typeof languages)[number]['code']

const zh = {
  appName: '国际象棋', unifiedLogin: '统一登录', continueWith: '使用 Integ.Life 继续',
  library: '棋谱库', courses: '课程', play: '对战', explore: '推演', updates: '更新',
  theme: '主题', themeAria: '选择网页与棋盘主题', language: '语言', languageAria: '选择界面语言', install: '安装',
  syncing: '同步中', online: '在线', offline: '离线', logout: '退出', viewHistory: '查看版本历史', gotIt: '我知道了',
  games: '棋谱', explorations: '推演', resources: '资源', newGame: '新对局', newExploration: '新推演',
  deleteGameConfirm: '确定删除这局棋谱？', deleteExplorationConfirm: '确定删除这个推演？', loadFailed: '加载失败',
  noGames: '还没有棋谱，去下一局并保存吧。', noExplorations: '还没有推演，去棋盘上摆一摆吧。',
  untitledGame: '未命名对局', untitledExploration: '未命名推演', moves: '着', unfinished: '未完', delete: '删除',
  curriculumEyebrow: '从规则到独立复盘', curriculumTitle: '国际象棋完整学习路线',
  curriculumIntro: '八个阶段，逐层建立规则、杀法、战术、开局、中局、残局和实战分析能力。每课都要能解释、能推演、能作答，而不只是看完一段文字。',
  stages: '阶段', lessons: '课程', available: '已开放', allStages: '完整八阶段', learningLoop: '统一学习闭环',
  explain: '讲清概念', calculate: '逐着推演', exercises: '局面练习', examples: '典型实战', review: '延迟复习',
  enterLessons: '进入 {count} 课 →', changelog: '版本历史', currentBuild: '当前构建', unexpectedError: '国际象棋发生意外错误，请刷新页面。',
} as const

type Key = keyof typeof zh
type Messages = Record<Key, string>

const translations: Record<Exclude<Locale, 'zh-CN'>, Messages> = {
  en: { appName:'Chess',unifiedLogin:'Single sign-on',continueWith:'Continue with Integ.Life',library:'Library',courses:'Courses',play:'Play',explore:'Analysis',updates:'Updates',theme:'Theme',themeAria:'Choose site and board theme',language:'Language',languageAria:'Choose interface language',install:'Install',syncing:'Syncing',online:'Online',offline:'Offline',logout:'Log out',viewHistory:'View version history',gotIt:'Got it',games:'Games',explorations:'Analyses',resources:'Resources',newGame:'New game',newExploration:'New analysis',deleteGameConfirm:'Delete this game?',deleteExplorationConfirm:'Delete this analysis?',loadFailed:'Failed to load',noGames:'No saved games yet. Play and save one.',noExplorations:'No analyses yet. Try a position on the board.',untitledGame:'Untitled game',untitledExploration:'Untitled analysis',moves:'moves',unfinished:'Unfinished',delete:'Delete',curriculumEyebrow:'From rules to independent review',curriculumTitle:'Complete Chess learning path',curriculumIntro:'Eight stages build your skills in rules, mating patterns, tactics, openings, middlegames, endgames, and practical analysis. Every lesson asks you to explain, calculate, and solve—not merely read.',stages:'Stages',lessons:'Lessons',available:'Available',allStages:'All eight stages',learningLoop:'Learning loop',explain:'Understand',calculate:'Calculate',exercises:'Position practice',examples:'Model games',review:'Spaced review',enterLessons:'Enter {count} lessons →',changelog:'Version history',currentBuild:'Current build',unexpectedError:'Chess encountered an unexpected error. Please refresh.' },
  es: { appName:'Ajedrez',unifiedLogin:'Inicio de sesión único',continueWith:'Continuar con Integ.Life',library:'Biblioteca',courses:'Cursos',play:'Jugar',explore:'Análisis',updates:'Novedades',theme:'Tema',themeAria:'Elegir tema del sitio y tablero',language:'Idioma',languageAria:'Elegir idioma de la interfaz',install:'Instalar',syncing:'Sincronizando',online:'En línea',offline:'Sin conexión',logout:'Salir',viewHistory:'Ver historial de versiones',gotIt:'Entendido',games:'Partidas',explorations:'Análisis',resources:'Recursos',newGame:'Nueva partida',newExploration:'Nuevo análisis',deleteGameConfirm:'¿Eliminar esta partida?',deleteExplorationConfirm:'¿Eliminar este análisis?',loadFailed:'Error al cargar',noGames:'Aún no hay partidas guardadas.',noExplorations:'Aún no hay análisis.',untitledGame:'Partida sin título',untitledExploration:'Análisis sin título',moves:'movimientos',unfinished:'Sin terminar',delete:'Eliminar',curriculumEyebrow:'De las reglas al análisis independiente',curriculumTitle:'Ruta completa de aprendizaje de ajedrez chino',curriculumIntro:'Ocho etapas desarrollan reglas, mates, táctica, aperturas, medio juego, finales y análisis práctico.',stages:'Etapas',lessons:'Lecciones',available:'Disponible',allStages:'Las ocho etapas',learningLoop:'Ciclo de aprendizaje',explain:'Comprender',calculate:'Calcular',exercises:'Práctica',examples:'Partidas modelo',review:'Repaso espaciado',enterLessons:'Entrar a {count} lecciones →',changelog:'Historial de versiones',currentBuild:'Versión actual',unexpectedError:'Se produjo un error inesperado. Actualiza la página.' },
  fr: { appName:'Chess',unifiedLogin:'Connexion unique',continueWith:'Continuer avec Integ.Life',library:'Bibliothèque',courses:'Cours',play:'Jouer',explore:'Analyse',updates:'Nouveautés',theme:'Thème',themeAria:'Choisir le thème du site et du plateau',language:'Langue',languageAria:"Choisir la langue de l’interface",install:'Installer',syncing:'Synchronisation',online:'En ligne',offline:'Hors ligne',logout:'Déconnexion',viewHistory:'Voir les versions',gotIt:'Compris',games:'Parties',explorations:'Analyses',resources:'Ressources',newGame:'Nouvelle partie',newExploration:'Nouvelle analyse',deleteGameConfirm:'Supprimer cette partie ?',deleteExplorationConfirm:'Supprimer cette analyse ?',loadFailed:'Échec du chargement',noGames:'Aucune partie enregistrée.',noExplorations:'Aucune analyse pour le moment.',untitledGame:'Partie sans titre',untitledExploration:'Analyse sans titre',moves:'coups',unfinished:'Inachevée',delete:'Supprimer',curriculumEyebrow:"Des règles à l’analyse autonome",curriculumTitle:"Parcours complet d’apprentissage du xiangqi",curriculumIntro:'Huit étapes couvrent les règles, les mats, la tactique, les ouvertures, le milieu de partie, les finales et l’analyse pratique.',stages:'Étapes',lessons:'Leçons',available:'Disponible',allStages:'Les huit étapes',learningLoop:"Cycle d’apprentissage",explain:'Comprendre',calculate:'Calculer',exercises:'Exercices',examples:'Parties modèles',review:'Révision espacée',enterLessons:'Voir {count} leçons →',changelog:'Historique des versions',currentBuild:'Version actuelle',unexpectedError:'Une erreur inattendue est survenue. Actualisez la page.' },
  de: { appName:'Schach',unifiedLogin:'Zentrale Anmeldung',continueWith:'Weiter mit Integ.Life',library:'Bibliothek',courses:'Kurse',play:'Spielen',explore:'Analyse',updates:'Neuigkeiten',theme:'Design',themeAria:'Website- und Brettdesign wählen',language:'Sprache',languageAria:'Oberflächensprache wählen',install:'Installieren',syncing:'Synchronisierung',online:'Online',offline:'Offline',logout:'Abmelden',viewHistory:'Versionsverlauf ansehen',gotIt:'Verstanden',games:'Partien',explorations:'Analysen',resources:'Ressourcen',newGame:'Neue Partie',newExploration:'Neue Analyse',deleteGameConfirm:'Diese Partie löschen?',deleteExplorationConfirm:'Diese Analyse löschen?',loadFailed:'Laden fehlgeschlagen',noGames:'Noch keine Partien gespeichert.',noExplorations:'Noch keine Analysen vorhanden.',untitledGame:'Unbenannte Partie',untitledExploration:'Unbenannte Analyse',moves:'Züge',unfinished:'Unvollendet',delete:'Löschen',curriculumEyebrow:'Von den Regeln zur eigenen Analyse',curriculumTitle:'Vollständiger Chess-Lernpfad',curriculumIntro:'Acht Stufen vermitteln Regeln, Mattbilder, Taktik, Eröffnung, Mittelspiel, Endspiel und praktische Analyse.',stages:'Stufen',lessons:'Lektionen',available:'Verfügbar',allStages:'Alle acht Stufen',learningLoop:'Lernkreislauf',explain:'Verstehen',calculate:'Berechnen',exercises:'Stellungen üben',examples:'Musterpartien',review:'Verteiltes Wiederholen',enterLessons:'{count} Lektionen öffnen →',changelog:'Versionsverlauf',currentBuild:'Aktueller Build',unexpectedError:'Ein unerwarteter Fehler ist aufgetreten. Bitte neu laden.' },
  id: { appName:'Catur',unifiedLogin:'Login terpadu',continueWith:'Lanjutkan dengan Integ.Life',library:'Pustaka',courses:'Kursus',play:'Bermain',explore:'Analisis',updates:'Pembaruan',theme:'Tema',themeAria:'Pilih tema situs dan papan',language:'Bahasa',languageAria:'Pilih bahasa antarmuka',install:'Instal',syncing:'Menyinkronkan',online:'Online',offline:'Offline',logout:'Keluar',viewHistory:'Lihat riwayat versi',gotIt:'Mengerti',games:'Partai',explorations:'Analisis',resources:'Sumber daya',newGame:'Partai baru',newExploration:'Analisis baru',deleteGameConfirm:'Hapus partai ini?',deleteExplorationConfirm:'Hapus analisis ini?',loadFailed:'Gagal memuat',noGames:'Belum ada partai tersimpan. Mainkan dan simpan satu partai.',noExplorations:'Belum ada analisis. Cobalah susunan posisi di papan.',untitledGame:'Partai tanpa judul',untitledExploration:'Analisis tanpa judul',moves:'langkah',unfinished:'Belum selesai',delete:'Hapus',curriculumEyebrow:'Dari aturan hingga ulasan mandiri',curriculumTitle:'Jalur belajar lengkap Catur',curriculumIntro:'Delapan tahap membangun kemampuan dalam aturan, pola skakmat, taktik, pembukaan, permainan tengah, permainan akhir, dan analisis praktis. Setiap pelajaran mengajak Anda menjelaskan, menghitung, dan memecahkan masalah—bukan sekadar membaca.',stages:'Tahap',lessons:'Pelajaran',available:'Tersedia',allStages:'Semua delapan tahap',learningLoop:'Siklus belajar',explain:'Memahami',calculate:'Menghitung',exercises:'Latihan posisi',examples:'Partai contoh',review:'Ulasan berkala',enterLessons:'Buka {count} pelajaran →',changelog:'Riwayat versi',currentBuild:'Versi saat ini',unexpectedError:'Terjadi kesalahan tak terduga. Silakan muat ulang halaman.' },
  ja: { appName:'チェス',unifiedLogin:'統合ログイン',continueWith:'Integ.Life で続行',library:'棋譜ライブラリ',courses:'コース',play:'対局',explore:'検討',updates:'更新',theme:'テーマ',themeAria:'サイトと盤のテーマを選択',language:'言語',languageAria:'表示言語を選択',install:'インストール',syncing:'同期中',online:'オンライン',offline:'オフライン',logout:'ログアウト',viewHistory:'バージョン履歴',gotIt:'了解',games:'棋譜',explorations:'検討',resources:'資料',newGame:'新規対局',newExploration:'新規検討',deleteGameConfirm:'この棋譜を削除しますか？',deleteExplorationConfirm:'この検討を削除しますか？',loadFailed:'読み込み失敗',noGames:'保存した棋譜はまだありません。',noExplorations:'検討はまだありません。',untitledGame:'無題の対局',untitledExploration:'無題の検討',moves:'手',unfinished:'未完',delete:'削除',curriculumEyebrow:'ルールから自立した検討へ',curriculumTitle:'チェス完全学習ロードマップ',curriculumIntro:'8つの段階でルール、詰み、戦術、序盤、中盤、終盤、実戦分析を学びます。',stages:'段階',lessons:'レッスン',available:'公開中',allStages:'全8段階',learningLoop:'学習サイクル',explain:'理解',calculate:'読み',exercises:'局面練習',examples:'モデル対局',review:'間隔反復',enterLessons:'{count}レッスンへ →',changelog:'バージョン履歴',currentBuild:'現在のビルド',unexpectedError:'予期しないエラーが発生しました。再読み込みしてください。' },
  ko: { appName:'체스',unifiedLogin:'통합 로그인',continueWith:'Integ.Life로 계속',library:'기보 라이브러리',courses:'강좌',play:'대국',explore:'분석',updates:'업데이트',theme:'테마',themeAria:'사이트와 보드 테마 선택',language:'언어',languageAria:'인터페이스 언어 선택',install:'설치',syncing:'동기화 중',online:'온라인',offline:'오프라인',logout:'로그아웃',viewHistory:'버전 기록 보기',gotIt:'확인',games:'기보',explorations:'분석',resources:'자료',newGame:'새 대국',newExploration:'새 분석',deleteGameConfirm:'이 기보를 삭제할까요?',deleteExplorationConfirm:'이 분석을 삭제할까요?',loadFailed:'로드 실패',noGames:'저장된 기보가 아직 없습니다.',noExplorations:'분석이 아직 없습니다.',untitledGame:'제목 없는 대국',untitledExploration:'제목 없는 분석',moves:'수',unfinished:'미완료',delete:'삭제',curriculumEyebrow:'규칙에서 독립 분석까지',curriculumTitle:'체스 완전 학습 경로',curriculumIntro:'8단계로 규칙, 외통수, 전술, 포진, 중반, 종반, 실전 분석을 익힙니다.',stages:'단계',lessons:'레슨',available:'공개',allStages:'전체 8단계',learningLoop:'학습 순환',explain:'이해',calculate:'수읽기',exercises:'형세 연습',examples:'모범 대국',review:'간격 복습',enterLessons:'{count}개 레슨 보기 →',changelog:'버전 기록',currentBuild:'현재 빌드',unexpectedError:'예상치 못한 오류가 발생했습니다. 새로고침해 주세요.' },
}

const storageKey = 'chess.locale'
function detectLocale(): Locale {
  const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey)
  if (languages.some(({ code }) => code === saved)) return saved as Locale
  const browser = typeof navigator === 'undefined' ? 'zh-CN' : navigator.language
  return languages.find(({ code }) => browser.toLowerCase().startsWith(code.toLowerCase().split('-')[0]))?.code ?? 'en'
}

interface I18nValue { locale: Locale; setLocale: (locale: Locale) => void; t: (key: Key, vars?: Record<string, string | number>) => string }
const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)
  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale(next) { localStorage.setItem(storageKey, next); setLocaleState(next) },
    t(key, vars) {
      let value: string = locale === 'zh-CN' ? zh[key] : translations[locale][key]
      for (const [name, replacement] of Object.entries(vars ?? {})) value = value.replaceAll(`{${name}}`, String(replacement))
      return value
    },
  }), [locale])
  useEffect(() => {
    document.documentElement.lang = locale
    document.title = locale === 'zh-CN' ? zh.appName : translations[locale].appName
  }, [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}

export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n()
  return <label className="board-theme-picker"><span className="board-theme-picker__label">{t('language')}</span><select aria-label={t('languageAria')} className="board-theme-picker__select" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
}
