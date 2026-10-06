import type { PhotoUpload } from '../types'

function statusBadge(row: PhotoUpload): { label: string; className: string } {
  if (row.status === 'queued') return { label: 'Queued', className: 'bg-gray-100 text-gray-500' }
  if (row.status === 'processing') return { label: 'Processing', className: 'bg-blue-50 text-blue-700' }
  if (row.status === 'error') return { label: 'Error', className: 'bg-red-50 text-red-600' }
  if (row.qc_status === 'rejected') return { label: 'Retake needed', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Accepted', className: 'bg-emerald-50 text-emerald-700' }
}

export function PhotoHistoryList({
  rows,
  loading,
  error,
  activeId,
  onSelect,
}: {
  rows: PhotoUpload[]
  loading: boolean
  error: string | null
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">History</h2>

      {error && <div className="text-sm text-red-500">{error}</div>}
      {loading && rows.length === 0 && <div className="text-sm text-gray-300">Loading…</div>}
      {!loading && rows.length === 0 && (
        <div className="text-sm text-gray-400">No photos uploaded yet.</div>
      )}

      <div className="flex flex-col gap-1">
        {rows.map(row => {
          const badge = statusBadge(row)
          const time = new Date(row.created_at).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
          return (
            <button
              key={row.id}
              onClick={() => onSelect(row.id)}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeId === row.id ? 'bg-emerald-50' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-sm text-gray-600">{time}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>
                {badge.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
