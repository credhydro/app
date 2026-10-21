import { Link } from 'react-router-dom'
import { TAB_LINKS, activeAlerts, alertTitle, type AlertsState } from '../hooks/useAlerts'

/** Top-of-Home card: the latest daily brief, plus a banner if any alert is open. */
export function DailyBriefCard({ alerts }: { alerts: AlertsState }) {
  const latest = alerts.briefs[0]
  const active = activeAlerts(alerts)
  const link = latest?.brief.worth_a_look_tab ? TAB_LINKS[latest.brief.worth_a_look_tab] : null

  return (
    <div className="flex flex-col gap-3">
      {active.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-3">
          <Link to="/alerts" className="flex-1 min-w-0">
            <span className="font-medium">
              {active.length === 1
                ? alertTitle(active[0].alert_type)
                : `${active.length} alerts need attention`}
            </span>
            <span className="ml-2 text-red-600">View →</span>
          </Link>
          <button
            onClick={() => alerts.dismiss(active.map(a => a.uuid))}
            className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-100"
            aria-label="Dismiss these alerts"
          >
            Dismiss
          </button>
        </div>
      )}

      {latest && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Daily brief</h2>
            <span className="text-xs text-gray-400">
              {new Date(latest.at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{latest.brief.summary}</p>

          {latest.brief.worth_a_look && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Worth a look</span>
              <span>{latest.brief.worth_a_look}</span>
              {link && <Link to={link.to} className="text-xs font-medium text-emerald-700 hover:underline">Open {link.label} →</Link>}
            </div>
          )}

          {latest.brief.growth && (
            <p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Growth: </span>{latest.brief.growth}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            {latest.brief.based_on && latest.brief.based_on.length > 0 && <span>Based on: {latest.brief.based_on.join(' · ')}</span>}
            <Link to="/alerts" className="hover:underline">Past briefs & alerts →</Link>
          </div>
        </section>
      )}
    </div>
  )
}
