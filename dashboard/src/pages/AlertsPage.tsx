import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAlerts, alertTitle, TAB_LINKS, type AlertRow } from '../hooks/useAlerts'

type Filter = 'attention' | 'all'

function fmt(iso: string): string {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function AlertsPage() {
  const { alerts, briefs, loading, error, dismiss, undismiss } = useAlerts()
  const [filter, setFilter] = useState<Filter>('attention')
  const [showDismissed, setShowDismissed] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [allBriefs, setAllBriefs] = useState(false)
  const briefsShown = allBriefs ? briefs : briefs.slice(0, 5)

  const inFilter = filter === 'all' ? alerts : alerts.filter(a => a.severity === 'warning' || a.severity === 'critical')
  const open = inFilter.filter(a => !a.dismissed)
  const dismissed = inFilter.filter(a => a.dismissed)
  const shown = showDismissed ? dismissed : open

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    const err = await action()
    setActionError(err ? `Couldn't update: ${err}` : null)
    setBusy(false)
  }

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-700">Alerts</h1>
      {error && <div className="text-sm text-red-500">{error}</div>}
      {actionError && <div className="text-sm text-red-500">{actionError}</div>}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Last 30 days</h2>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {(['attention', 'all'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 ${filter === f ? 'bg-gray-100 text-gray-700 font-medium' : 'text-gray-500'}`}
              >
                {f === 'attention' ? 'Needs attention' : 'Everything'}
              </button>
            ))}
          </div>
        </div>

        {!showDismissed && open.length > 1 && (
          <div className="flex justify-end -mt-2">
            <button
              onClick={() => run(() => dismiss(open.map(a => a.uuid)))}
              disabled={busy}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40"
            >
              Dismiss all {open.length}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-500">
            {showDismissed ? 'Nothing dismissed.' : 'No alerts — everything has been running normally.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {shown.map(a => (
              <AlertItem
                key={a.uuid}
                a={a}
                busy={busy}
                onDismiss={() => run(() => dismiss([a.uuid]))}
                onUndo={() => run(() => undismiss(a.uuid))}
              />
            ))}
          </ul>
        )}

        {(dismissed.length > 0 || showDismissed) && (
          <button
            onClick={() => setShowDismissed(v => !v)}
            className="self-start text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            {showDismissed ? '← Back to open alerts' : `Show dismissed (${dismissed.length})`}
          </button>
        )}
        <p className="text-xs text-gray-400">Alerts reach this page within about an hour. Critical ones will also be sent by text once SMS is set up.</p>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Past daily briefs</h2>
        {briefs.length === 0 ? (
          <p className="text-sm text-gray-500">No briefs yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {briefsShown.map(({ at, brief }) => {
              const link = brief.worth_a_look_tab ? TAB_LINKS[brief.worth_a_look_tab] : null
              return (
                <li key={at} className="py-3 flex flex-col gap-1.5">
                  <span className="text-xs text-gray-400">
                    {new Date(at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <p className="text-sm text-gray-700">{brief.summary}</p>
                  {brief.worth_a_look && (
                    <p className="text-sm text-emerald-800">
                      <span className="font-medium">Worth a look: </span>{brief.worth_a_look}
                      {link && <> <Link to={link.to} className="text-xs text-emerald-700 hover:underline">{link.label} →</Link></>}
                    </p>
                  )}
                  {brief.growth && <p className="text-sm text-gray-600"><span className="font-medium">Growth: </span>{brief.growth}</p>}
                </li>
              )
            })}
          </ul>
        )}
        {briefs.length > 5 && (
          <button onClick={() => setAllBriefs(v => !v)} className="self-start text-xs font-medium text-gray-500 hover:text-gray-700">
            {allBriefs ? 'Show fewer' : `Show older (${briefs.length - 5})`}
          </button>
        )}
      </section>
    </div>
  )
}

function AlertItem({ a, busy, onDismiss, onUndo }: {
  a: AlertRow
  busy: boolean
  onDismiss: () => void
  onUndo: () => void
}) {
  const dot =
    a.resolved ? 'bg-gray-300'
    : a.severity === 'critical' ? 'bg-red-500'
    : a.severity === 'warning' ? 'bg-amber-400'
    : 'bg-emerald-400'
  return (
    <li className="py-3 flex gap-3">
      <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-sm font-medium ${a.resolved ? 'text-gray-500' : 'text-gray-800'}`}>{alertTitle(a.alert_type)}</span>
          {a.severity === 'critical' && !a.resolved && <span className="text-xs font-semibold text-red-600 uppercase">Critical</span>}
          {a.resolved && <span className="text-xs text-gray-400">Resolved</span>}
        </div>
        <p className={`text-sm ${a.resolved ? 'text-gray-400' : 'text-gray-600'}`}>{a.message}</p>
        <span className="text-xs text-gray-400">{fmt(a.datetime_utc)}</span>
      </div>
      <button
        onClick={a.dismissed ? onUndo : onDismiss}
        disabled={busy}
        className="ml-auto self-start shrink-0 text-xs font-medium text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        aria-label={a.dismissed ? 'Restore this alert' : 'Dismiss this alert'}
      >
        {a.dismissed ? 'Undo' : 'Dismiss'}
      </button>
    </li>
  )
}
