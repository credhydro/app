import type { PhotoUpload } from '../types'
import { PhotoOverlayImage } from './PhotoOverlayImage'

const STALL_MS = 2 * 60 * 1000

export function PhotoStatusView({
  row,
  loading,
  error,
  onRetake,
}: {
  row: PhotoUpload | null
  loading: boolean
  error: string | null
  onRetake: () => void
}) {
  if (error) {
    return <div className="text-sm text-red-500">{error}</div>
  }

  if (loading && !row) {
    return <div className="text-sm text-gray-300">Loading…</div>
  }

  if (!row) return null

  if (row.status === 'queued' || row.status === 'processing') {
    const stalled =
      row.status === 'queued' &&
      Date.now() - new Date(row.created_at).getTime() > STALL_MS

    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
        <ClockIcon />
        <span>
          {stalled
            ? "Your Argonaut hasn't picked this up yet. It may be offline. Your photo is saved and will be analysed when the device reconnects."
            : row.status === 'queued'
            ? 'Uploaded — waiting for your Argonaut to pick it up.'
            : 'Analysing your photo…'}
        </span>
      </div>
    )
  }

  if (row.status === 'done' && row.qc_status === 'ok') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <p className="text-sm font-medium text-gray-700">{row.message}</p>

        {row.overlay_path && <PhotoOverlayImage overlayPath={row.overlay_path} />}

        {row.result && row.result.plants.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase text-left">
                  <th className="py-1 pr-2">Plant</th>
                  <th className="py-1 pr-2">Area (cm²)</th>
                  <th className="py-1 pr-2">Change</th>
                  <th className="py-1">Growth</th>
                </tr>
              </thead>
              <tbody>
                {row.result.plants.map(p => (
                  <tr key={p.plant_id} className="border-t border-gray-100 text-gray-700">
                    <td className="py-1.5 pr-2">{p.plant_id}</td>
                    <td className="py-1.5 pr-2">
                      {p.canopy_area_cm2 != null ? p.canopy_area_cm2.toFixed(1) : '—'}
                    </td>
                    <td className="py-1.5 pr-2">
                      {p.prev_area_cm2 == null ? (
                        <span className="text-gray-400 italic">First photo</span>
                      ) : p.change_pct != null ? (
                        `${p.change_pct > 0 ? '+' : ''}${p.change_pct.toFixed(1)}%`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-1.5">
                      {p.prev_area_cm2 == null ? (
                        <span className="text-gray-400 italic">First photo</span>
                      ) : p.rgr_pct_per_day != null ? (
                        `${p.rgr_pct_per_day.toFixed(1)}%/day`
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {row.result?.summary && (
          <p className="text-xs text-gray-400">
            Mean area {row.result.summary.mean_area_cm2.toFixed(1)} cm² · spread{' '}
            {row.result.summary.spread_ratio.toFixed(2)}
          </p>
        )}

        <button
          onClick={onRetake}
          className="py-2.5 rounded-xl text-sm font-medium transition-colors bg-gray-200 hover:bg-gray-300 text-gray-700"
        >
          Take another photo
        </button>
      </div>
    )
  }

  if (row.status === 'done' && row.qc_status === 'rejected') {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <WarningIcon />
          <span className="font-medium">{row.message}</span>
        </div>

        {row.overlay_path && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <PhotoOverlayImage overlayPath={row.overlay_path} />
          </div>
        )}

        <button
          onClick={onRetake}
          className="py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          Retake photo
        </button>
      </div>
    )
  }

  // status === 'error'
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <p className="text-sm text-gray-700">
        {row.message ?? 'Something went wrong analysing this photo.'}
      </p>
      <button
        onClick={onRetake}
        className="py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white"
      >
        Try again
      </button>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.743 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 7a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  )
}
