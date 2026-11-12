/** Small "which grow" selector for the growth views: current grow first, past grows below. */
export function GrowPicker({ trial, current, options, onChange }: {
  trial: string | null
  current: string | null
  options: string[]
  onChange: (t: string | null) => void
}) {
  if (options.length === 0) return null
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="sr-only">Grow</span>
      <select
        value={trial ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
      >
        {!current && <option value="">All photos</option>}
        {options.map(t => (
          <option key={t} value={t}>
            {t === current ? `${t} · current grow` : t === 'maintenance' ? 'maintenance (between grows)' : `${t} · past grow`}
          </option>
        ))}
      </select>
    </label>
  )
}
