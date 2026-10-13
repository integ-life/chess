import type { Locale } from './i18n'
import type { BoardTheme } from './stores/boardThemeStore'

export const boardThemeTranslations: Record<Locale, Record<BoardTheme, { name: string; description: string }>> = {
  'zh-CN': {
      classic: { name: '经典轻量', description: '清爽耐看，关闭所有装饰动画' },
      rosewood: { name: '紫檀木雕', description: '立体木纹、浮雕棋子与柔和投影' },
      neon: { name: '量子霓虹', description: '深空玻璃、青红光轨与能量棋子' },
      starlight: { name: '星河鎏金', description: '夜空棋台、流金线条与闪耀星尘' },
  },
  en: {
      classic: { name: 'Classic Lite', description: 'A clean, lightweight theme with decorative animation disabled' },
      rosewood: { name: 'Carved Rosewood', description: 'Layered wood grain, embossed pieces, and soft shadows' },
      neon: { name: 'Quantum Neon', description: 'Deep-space glass, red-cyan light trails, and energy pieces' },
      starlight: { name: 'Gilded Starlight', description: 'A night-sky board with golden lines and sparkling stardust' },
  },
  es: {
      classic: { name: 'Clásico ligero', description: 'Tema limpio y ligero sin animaciones decorativas' },
      rosewood: { name: 'Palisandro tallado', description: 'Vetas de madera, piezas en relieve y sombras suaves' },
      neon: { name: 'Neón cuántico', description: 'Cristal espacial, estelas rojas y cian y piezas de energía' },
      starlight: { name: 'Luz estelar dorada', description: 'Tablero nocturno con líneas doradas y polvo de estrellas' },
  },
  fr: {
      classic: { name: 'Classique léger', description: 'Un thème sobre et léger, sans animation décorative' },
      rosewood: { name: 'Palissandre sculpté', description: 'Veines du bois, pièces en relief et ombres douces' },
      neon: { name: 'Néon quantique', description: 'Verre spatial, traînées rouge et cyan et pièces d’énergie' },
      starlight: { name: 'Éclat stellaire doré', description: 'Plateau nocturne, lignes dorées et poussière d’étoiles' },
  },
  de: {
      classic: { name: 'Klassisch leicht', description: 'Ein klares, ressourcenschonendes Design ohne Zieranimationen' },
      rosewood: { name: 'Geschnitztes Rosenholz', description: 'Holzmaserung, erhabene Figuren und weiche Schatten' },
      neon: { name: 'Quantenneon', description: 'Weltraumglas, rot-türkise Lichtspuren und Energiefiguren' },
      starlight: { name: 'Vergoldetes Sternenlicht', description: 'Nachthimmelbrett mit goldenen Linien und Sternenstaub' },
  },
  id: {
      classic: { name: 'Klasik ringan', description: 'Tema bersih dan ringan tanpa animasi dekoratif' },
      rosewood: { name: 'Rosewood berukir', description: 'Serat kayu, bidak timbul, dan bayangan lembut' },
      neon: { name: 'Neon kuantum', description: 'Kaca angkasa, jejak cahaya merah-sian, dan bidak energi' },
      starlight: { name: 'Cahaya bintang keemasan', description: 'Papan langit malam dengan garis emas dan debu bintang' },
  },
  ja: {
      classic: { name: 'クラシック・ライト', description: '装飾アニメーションを省いた軽量で見やすいテーマ' },
      rosewood: { name: '紫檀彫刻', description: '木目、浮き彫りの駒、柔らかな影を重ねたテーマ' },
      neon: { name: 'クォンタム・ネオン', description: '宇宙ガラス、赤とシアンの光跡、エネルギー駒' },
      starlight: { name: '金彩スターライト', description: '夜空の盤、金色の線、きらめく星屑' },
  },
  ko: {
      classic: { name: '클래식 라이트', description: '장식 애니메이션을 끈 깔끔하고 가벼운 테마' },
      rosewood: { name: '조각 자단목', description: '나뭇결, 양각 기물과 부드러운 그림자' },
      neon: { name: '퀀텀 네온', description: '우주 유리, 적색·청록 빛줄기와 에너지 기물' },
      starlight: { name: '금빛 별빛', description: '밤하늘 보드, 금빛 선과 반짝이는 별가루' },
  },
}
