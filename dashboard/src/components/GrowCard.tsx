import { Link } from 'react-router-dom'
import { MAINTENANCE, day0Of, daysSince, useGrow } from '../hooks/useGrow'

/** Home card (admin for now): the active grow, with Register harvest / Start a new grow. */
export function GrowCard() {
  const { active, trial, lastHarvest, configLoaded } = useGrow()
  if (!configLoaded) return null
  const inMaintenance = !active || active === MAINTENANCE
  const day0 = day0Of(trial)
  const day = daysSince(day0)
  const lastSummary = parseSummary(lastHarvest?.summary ?? null)

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Grow</h2>
        <span className="text-xs text-gray-400">Admin</span>
      </div>
      {inMaintenance ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-gray-700">No active grow — the unit is in maintenance.</p>
          {lastHarvest && (
            <p className="text-xs text-gray-500">
              Last harvest: {lastHarvest.trial_name} on {fmtDate(lastHarvest.harvest_date)}
              {lastHarvest.marketable_mass_g != null && ` · ${Math.round(lastHarvest.marketable_mass_g)} g marketable`}
              {lastSummary?.days_grown != null && ` · ${lastSummary.days_grown} days`}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-semibold text-gray-700">
            {cropLabel(trial?.cultivar, trial?.crop_type) || active}
            <span className="ml-2 text-sm font-normal text-gray-400">{active}</span>
          </p>
          <p className="text-sm text-gray-500">
            {day !== null && day >= 0 ? `Day ${day} since transplant (${fmtDate(day0)})` : 'Transplant date not recorded'}
            {trial?.plant_count ? ` · ${trial.plant_count} plants` : ''}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!inMaintenance && (
          <Link to="/harvest" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Register harvest
          </Link>
        )}
        <Link to="/start-grow"
          className={inMaintenance
            ? 'rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700'
            : 'rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50'}>
          Start a new grow
        </Link>
      </div>
    </section>
  )
}

/** "Little Gem lettuce", but not "salad lettuce lettuce". */
export function cropLabel(cultivar?: string | null, crop?: string | null): string {
  if (cultivar && crop && cultivar.toLowerCase().includes(crop.toLowerCase())) return cultivar
  return [cultivar, crop].filter(Boolean).join(' ')
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function parseSummary(s: string | null): { days_grown?: number } | null {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}
