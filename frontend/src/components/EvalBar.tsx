interface Props {
  scoreCp?: number
  scoreMate?: number
  depth?: number
  pending?: boolean
}

// 红方占比，sigmoid(cp/400)
function redShare(cp: number): number {
  return 1 / (1 + Math.exp(-cp / 400))
}

export default function EvalBar({ scoreCp, scoreMate, depth, pending }: Props) {
  let share = 0.5
  let label = '—'
  if (scoreMate !== undefined && scoreMate !== 0) {
    share = scoreMate > 0 ? 1 : 0
    label = scoreMate > 0 ? `红M${scoreMate}` : `黑M${-scoreMate}`
  } else if (scoreCp !== undefined) {
    share = redShare(scoreCp)
    const v = scoreCp / 100
    label = `${v > 0 ? '+' : ''}${v.toFixed(1)}`
  }
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full bg-red-600 transition-[width] duration-300"
          style={{ width: `${share * 100}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/60" />
      </div>
      <span className="w-16 text-right font-mono text-xs text-gray-600">
        {label}
        {depth ? <span className="text-gray-400"> d{depth}</span> : null}
        {pending && <span className="animate-pulse text-amber-600">·</span>}
      </span>
    </div>
  )
}
