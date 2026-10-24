import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { sendSettingsCommand } from '../hooks/useDeviceConfig'
import { useSensorStatus, type AccuracyStatus, type SensorCheck, type WorkingStatus } from '../hooks/useSensorStatus'
import { SensorCheckWizard } from '../components/SensorCheckWizard'

const WORKING_PILL: Record<WorkingStatus['status'], { text: string; cls: string }> = {
  ok: { text: 'Working normally', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  watch: { text: 'Worth watching', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  problem: { text: 'Readings not trustworthy', cls: 'bg-red-50 text-red-700 border-red-200' },
}

const ACCURACY_PILL: Record<AccuracyStatus['state'], { text: string; cls: string }> = {
  good: { text: 'Verified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  check_due: { text: 'Check due', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  drifted: { text: 'Outside tolerance', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  swap_due: { text: 'Module swap due', cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { text: 'Not verified yet', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const REF_LABEL: Record<string, string> = {
  ph7: 'pH 7.00', ph4: 'pH 4.00', ph10: 'pH 10.00', ec1413: '1413 µS/cm', ec84: '84 µS/cm', ec12880: '12,880 µS/cm', dry: 'Dry (air)',
}

function days(n: number | null): string {
  if (n === null) return '—'
  if (n < 1) return 'today'
  const d = Math.round(n)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function date(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function errText(v: number | null, unit: string): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return unit === 'pH' ? `${sign}${v.toFixed(2)} pH` : unit === '%' ? `${sign}${v.toFixed(1)}%` : `${v} ${unit}`
}

function Pill({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{text}</span>
}

export function SensorsPage() {
  const { selectedDevice, selectedTrial } = useAuth()
  const { status, updatedAt, checks, loading, error, refresh } = useSensorStatus()
  const [wizard, setWizard] = useState<'ph' | 'ec' | null>(null)

  if (!selectedDevice) return <Shell><p className="text-sm text-gray-500">No Argonaut assigned to your account yet.</p></Shell>

  const now = Date.now()
  const outUntil = (s: 'ph' | 'ec') => {
    const iso = status?.probe_out_until?.[s]
    return iso && new Date(iso).getTime() > now ? new Date(iso) : null
  }

  return (
    <Shell>
      <p className="text-sm text-gray-500 -mt-3">
        <span className="font-medium text-gray-600">Working</span> tells you whether a sensor’s readings are behaving
        normally. <span className="font-medium text-gray-600">Accurate</span> tells you how far off it was at its last check —
        only a check in a buffer or standard can tell you that.
      </p>
      {error && <div className="text-sm text-red-500">{error}</div>}
      {!status ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {loading ? 'Loading…' : 'Waiting for Argonaut to report sensor status. It reports every 30 minutes.'}
        </div>
      ) : (
        <>
          {(['ph', 'ec'] as const).map(s => {
            const until = outUntil(s)
            return until ? (
              <ProbeOutBanner key={s} sensor={s} until={until} deviceId={selectedDevice} trial={selectedTrial} onDone={refresh} />
            ) : null
          })}

          <ProbeCard
            title="pH"
            working={status.working.ph}
            acc={status.accurate.ph}
            checkLabel="Do the 2-minute pH check"
            wizardOpen={wizard === 'ph'}
            onCheck={() => setWizard('ph')}
            wizard={<SensorCheckWizard sensor="ph" onClose={() => { setWizard(null); refresh() }} />}
          />
          <ProbeCard
            title="EC"
            working={status.working.ec_us}
            acc={status.accurate.ec}
            checkLabel="Check the EC probe"
            wizardOpen={wizard === 'ec'}
            onCheck={() => setWizard('ec')}
            wizard={<SensorCheckWizard sensor="ec" onClose={() => { setWizard(null); refresh() }} />}
          />

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Air sensors</h2>
            {(['airtemp_C', 'humidity_pct'] as const).map(k => {
              const w = status.working[k]
              if (!w) return null
              return (
                <div key={k} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">{w.label}</span>
                    <Pill {...WORKING_PILL[w.status]} />
                  </div>
                  {w.reasons.map(r => <p key={r} className="text-xs text-gray-500">{r}</p>)}
                </div>
              )
            })}
          </section>

          <CheckHistory checks={checks} />

          {updatedAt && (
            <p className="text-xs text-gray-400">
              Status from Argonaut {new Date(updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {' '}· updates every 30 minutes and after every check.
            </p>
          )}
        </>
      )}
    </Shell>
  )
}

function ProbeCard({ title, working, acc, checkLabel, wizardOpen, onCheck, wizard }: {
  title: string
  working: WorkingStatus | undefined
  acc: AccuracyStatus
  checkLabel: string
  wizardOpen: boolean
  onCheck: () => void
  wizard: React.ReactNode
}) {
  const unit = acc.unit
  const est = acc.estimated_error_now
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-500 tracking-wide">{title} probe</h2>
        {acc.probe_name && <span className="text-xs text-gray-400">{acc.probe_name}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Working</span>
            {working && <Pill {...WORKING_PILL[working.status]} />}
          </div>
          {!working || working.reasons.length === 0 ? (
            <p className="text-sm text-gray-600">Readings over the last 24 hours look like a healthy sensor — no jumps, gaps or stuck values.</p>
          ) : (
            working.reasons.map(r => <p key={r} className="text-sm text-gray-600">{r}</p>)
          )}
          {working?.action && <p className="text-sm text-gray-800"><span className="font-medium">Try: </span>{working.action}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Accurate</span>
            <Pill {...ACCURACY_PILL[acc.state]} />
          </div>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-gray-400">Last verified</dt>
            <dd className="text-gray-700">
              {days(acc.days_since_verified)}
              {acc.last_check && <span className="text-gray-400"> · was {errText(acc.last_check.error, unit)}</span>}
            </dd>
            {title === 'pH' && (
              <>
                <dt className="text-gray-400">Correction</dt>
                <dd className="text-gray-700">{acc.offset_applied ? `${errText(-acc.offset_applied, 'pH')} applied to readings` : 'None'}</dd>
              </>
            )}
            <dt className="text-gray-400">Probably off by</dt>
            <dd className="text-gray-700">
              {est === null ? 'Unknown until the first check' : `about ${errText(est, unit).replace('+', '')} now`}
              {est !== null && (
                <span className="block text-xs text-gray-400">
                  Estimate from {acc.checks_since_calibration} check{acc.checks_since_calibration === 1 ? '' : 's'}
                  {acc.drift_per_30_days !== null && ` · drifting about ${errText(acc.drift_per_30_days, unit).replace('+', '')} a month`}
                  {acc.checks_since_calibration < 3 && ' · firms up with more checks'}
                </span>
              )}
            </dd>
            <dt className="text-gray-400">Next check by</dt>
            <dd className="text-gray-700">
              {date(acc.next_check_by)}
              {acc.next_check_reason === 'drift' && <span className="block text-xs text-gray-400">earlier than the usual schedule — at its current drift it would pass ±{acc.tolerance} {unit} by then</span>}
            </dd>
            <dt className="text-gray-400">Module swap</dt>
            <dd className="text-gray-700">{acc.swap_by ? date(acc.swap_by) : '—'}</dd>
          </dl>
          {acc.action && <p className="text-sm text-gray-800">{acc.action}</p>}
        </div>
      </div>

      {wizardOpen ? wizard : (
        <button onClick={onCheck} className="self-start rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
          {checkLabel}
        </button>
      )}
    </section>
  )
}

function ProbeOutBanner({ sensor, until, deviceId, trial, onDone }: {
  sensor: 'ph' | 'ec'; until: Date; deviceId: string; trial: string | null; onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-800">
        The {sensor === 'ph' ? 'pH' : 'EC'} probe is marked as out of the reservoir until{' '}
        {until.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} —{' '}
        {sensor === 'ph' ? 'pH logging and dosing are paused.' : 'EC logging is paused.'}
      </p>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true)
          sendSettingsCommand(deviceId, 'sensor_probe_in', { sensor }, trial, o => {
            if (o.state !== 'waiting') { setBusy(false); onDone() }
          })
        }}
        className="rounded-lg bg-white border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-40"
      >
        {busy ? 'Telling Argonaut…' : 'It’s back in'}
      </button>
    </div>
  )
}

function CheckHistory({ checks }: { checks: SensorCheck[] }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Check history</h2>
      {checks.length === 0 ? (
        <p className="text-sm text-gray-500">No checks yet. Each check shows how far a probe had drifted — over time they show how fast it drifts.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="py-1.5 pr-3 font-medium">Date</th>
                <th className="py-1.5 pr-3 font-medium">Probe</th>
                <th className="py-1.5 pr-3 font-medium">In</th>
                <th className="py-1.5 pr-3 font-medium">Read</th>
                <th className="py-1.5 pr-3 font-medium">Off by</th>
                <th className="py-1.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {checks.map(c => (
                <tr key={c.uuid} className="text-gray-700">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{date(c.datetime_utc)}</td>
                  <td className="py-1.5 pr-3">{c.sensor === 'ph' ? 'pH' : 'EC'}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{REF_LABEL[c.reference] ?? c.reference}</td>
                  <td className="py-1.5 pr-3">{c.reading ?? '—'}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{errText(c.error, c.error_unit ?? '')}</td>
                  <td className="py-1.5 text-xs text-gray-400 whitespace-nowrap">
                    {c.applied_offset !== null ? 'Correction applied' : c.stable === false ? 'Not settled' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-700">Sensors</h1>
      {children}
    </div>
  )
}
