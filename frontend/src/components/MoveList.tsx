interface MoveListProps {
  // 中文记法着法，偶数下标为红方
  moves: string[]
  // 当前高亮的着数（1-based），undefined 表示最后一步
  current?: number
  onSelect?: (moveIndex: number) => void
}

export default function MoveList({ moves, current, onSelect }: MoveListProps) {
  const cur = current ?? moves.length
  const rows: { no: number; red?: string; black?: string }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ no: i / 2 + 1, red: moves[i], black: moves[i + 1] })
  }
  const cellClass = (idx: number) =>
    `px-2 py-0.5 rounded cursor-pointer ${
      idx === cur ? 'bg-amber-600 text-white' : 'hover:bg-amber-100'
    }`
  return (
    <div className="max-h-96 overflow-y-auto font-mono text-sm">
      {rows.length === 0 && <p className="text-gray-400">尚无着法</p>}
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.no}>
              <td className="pr-2 text-right text-gray-400">{row.no}.</td>
              <td>
                {row.red && (
                  <span className={cellClass(row.no * 2 - 1)} onClick={() => onSelect?.(row.no * 2 - 1)}>
                    {row.red}
                  </span>
                )}
              </td>
              <td>
                {row.black && (
                  <span className={cellClass(row.no * 2)} onClick={() => onSelect?.(row.no * 2)}>
                    {row.black}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
