import type { Piece } from '../../chess/types'
import type { BoardTheme } from '../../stores/boardThemeStore'

const GLYPH: Record<string, string> = {
  rk: '帥', ra: '仕', re: '相', rh: '馬', rr: '車', rc: '炮', rp: '兵',
  bk: '將', ba: '士', be: '象', bh: '馬', br: '車', bc: '砲', bp: '卒',
}

interface Props {
  piece: Piece
  x: number
  y: number
  theme: BoardTheme
  defsPrefix: string
  checked?: boolean
  onClick?: () => void
}

export default function PieceGlyph({ piece, x, y, theme, defsPrefix, checked, onClick }: Props) {
  const color = piece.color === 'r' ? 'var(--piece-red)' : 'var(--piece-black)'
  const fill = theme === 'classic' ? '#f6e5bf' : `url(#${defsPrefix}-piece)`
  return (
    <g
      onClick={onClick}
      className={`board-piece board-piece--${piece.color} cursor-pointer`}
      filter={theme === 'rosewood' || theme === 'neon' ? `url(#${defsPrefix}-piece-fx)` : undefined}
    >
      {checked && <circle cx={x} cy={y} r="49" className="check-pulse piece-check" />}
      <circle className="piece-disc" cx={x} cy={y} r="42" fill={fill} stroke={color} strokeWidth="3" />
      <circle className="piece-rim" cx={x} cy={y} r="36" fill="none" stroke={color} strokeWidth="1.5" />
      {theme !== 'classic' && (
        <path
          className="piece-glint"
          d={`M${x - 25} ${y - 16} A31 31 0 0 1 ${x + 18} ${y - 29}`}
          fill="none"
          stroke="rgba(255,255,255,0.48)"
          strokeLinecap="round"
          strokeWidth="3"
        />
      )}
      <text
        className="piece-label"
        x={x}
        y={y}
        fontSize="44"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Kaiti SC, STKaiti, serif"
      >
        {GLYPH[piece.color + piece.type]}
      </text>
    </g>
  )
}
