import type { BoardTheme } from '../../stores/boardThemeStore'

interface Props {
  prefix: string
  theme: BoardTheme
}

export default function BoardThemeDefs({ prefix, theme }: Props) {
  if (theme === 'classic') return null

  if (theme === 'rosewood') {
    return (
      <defs>
        <linearGradient id={`${prefix}-surface`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6e321d" />
          <stop offset="0.32" stopColor="#b56b3c" />
          <stop offset="0.58" stopColor="#7c3d24" />
          <stop offset="1" stopColor="#3c1712" />
        </linearGradient>
        <radialGradient id={`${prefix}-piece`} cx="32%" cy="24%" r="78%">
          <stop offset="0" stopColor="#fff1c9" />
          <stop offset="0.48" stopColor="#d5a66c" />
          <stop offset="0.82" stopColor="#9b5e32" />
          <stop offset="1" stopColor="#5c2b1c" />
        </radialGradient>
        <linearGradient id={`${prefix}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1b96b" />
          <stop offset="0.42" stopColor="#6f2c1a" />
          <stop offset="0.7" stopColor="#d88a4b" />
          <stop offset="1" stopColor="#38140e" />
        </linearGradient>
        <filter id={`${prefix}-board-fx`} x="-12%" y="-10%" width="124%" height="124%">
          <feTurbulence baseFrequency="0.012 0.09" numOctaves="2" seed="7" type="fractalNoise" result="grain" />
          <feColorMatrix in="grain" type="saturate" values="0" result="mono" />
          <feBlend in="SourceGraphic" in2="mono" mode="soft-light" />
        </filter>
        <filter id={`${prefix}-piece-fx`} x="-35%" y="-35%" width="180%" height="190%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#1f0906" floodOpacity="0.72" />
          <feDropShadow dx="0" dy="-2" stdDeviation="2" floodColor="#ffe0a3" floodOpacity="0.34" />
        </filter>
      </defs>
    )
  }

  if (theme === 'neon') {
    return (
      <defs>
        <radialGradient id={`${prefix}-surface`} cx="50%" cy="42%" r="72%">
          <stop offset="0" stopColor="#142749" />
          <stop offset="0.52" stopColor="#071427" />
          <stop offset="1" stopColor="#02060f" />
        </radialGradient>
        <radialGradient id={`${prefix}-piece`} cx="34%" cy="24%" r="78%">
          <stop offset="0" stopColor="#e8fbff" stopOpacity="0.92" />
          <stop offset="0.18" stopColor="#69d9e8" stopOpacity="0.4" />
          <stop offset="0.48" stopColor="#12253e" stopOpacity="0.94" />
          <stop offset="1" stopColor="#020813" />
        </radialGradient>
        <linearGradient id={`${prefix}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.45" stopColor="#334155" />
          <stop offset="0.72" stopColor="#fb7185" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
        <pattern id={`${prefix}-circuit`} width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M0 20H24V0 M76 100V78H100 M18 62H38V82H54" fill="none" stroke="#22d3ee" strokeOpacity="0.12" strokeWidth="2" />
          <circle cx="38" cy="62" r="3" fill="#fb7185" fillOpacity="0.28" />
        </pattern>
        <filter id={`${prefix}-piece-fx`} x="-45%" y="-45%" width="190%" height="190%">
          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#22d3ee" floodOpacity="0.55" />
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#000611" floodOpacity="0.9" />
        </filter>
      </defs>
    )
  }

  return (
    <defs>
      <radialGradient id={`${prefix}-surface`} cx="48%" cy="36%" r="78%">
        <stop offset="0" stopColor="#2a2252" />
        <stop offset="0.38" stopColor="#171431" />
        <stop offset="0.74" stopColor="#090b1d" />
        <stop offset="1" stopColor="#03050d" />
      </radialGradient>
      <radialGradient id={`${prefix}-piece`} cx="34%" cy="24%" r="82%">
        <stop offset="0" stopColor="#fff9dc" />
        <stop offset="0.24" stopColor="#f5d78d" />
        <stop offset="0.56" stopColor="#89602c" />
        <stop offset="0.82" stopColor="#2d2034" />
        <stop offset="1" stopColor="#080812" />
      </radialGradient>
      <linearGradient id={`${prefix}-frame`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff3ad" />
        <stop offset="0.3" stopColor="#b7792c" />
        <stop offset="0.54" stopColor="#f7d77b" />
        <stop offset="0.76" stopColor="#76511f" />
        <stop offset="1" stopColor="#ffe8a1" />
      </linearGradient>
      <pattern id={`${prefix}-stars`} width="180" height="160" patternUnits="userSpaceOnUse">
        <circle cx="18" cy="24" r="1.6" fill="#fff7c2" opacity="0.7" />
        <circle cx="92" cy="44" r="1" fill="#c4b5fd" opacity="0.62" />
        <circle cx="154" cy="118" r="1.4" fill="#fef3c7" opacity="0.8" />
        <circle cx="48" cy="132" r="0.9" fill="#fff" opacity="0.55" />
      </pattern>
    </defs>
  )
}
