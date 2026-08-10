interface Props {
  note: string
  disabled?: boolean
  onChange: (note: string) => void
}

export default function NoteEditor({ note, disabled, onChange }: Props) {
  return (
    <textarea
      className="h-24 w-full resize-y rounded-md border border-amber-200 p-2 text-sm focus:border-amber-500 focus:outline-none disabled:bg-gray-50"
      placeholder={disabled ? '选择一步棋后可添加批注' : '本步批注…'}
      value={note}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
