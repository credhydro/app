import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useDeviceConfig, sendSettingsCommand, type CommandOutcome, type DeviceConfig } from '../hooks/useDeviceConfig'
import { Card, Field, NumberInput, SaveRow, diff } from '../components/FormBits'

const PAUSE_OPTIONS = [15, 30, 60, 120]

interface LastRun {
  datetime_utc: string
  pump_on_mins: number | null
  avg_rate_lpm: number | null
}

/** Most recent logged circulation row. Rows sync from the Pi hourly, so this can lag. */
function useLastRun(deviceId: string | null): LastRun | null {
  const [row, setRow] = useState<LastRun | null>(null)
  useEffect(() => {
    if (!deviceId) return
    let cancelled = false
    async function load() {
      const res = await supabase
        .from('circulation')
        .select('datetime_utc, pump_on_mins, avg_rate_lpm')
        .eq('device_id', deviceId)
        .order('datetime_utc', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled && !res.error) setRow((res.data as LastRun | null) ?? null)
    }
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [deviceId])
  return row
}

/** Re-render every 30 s so the pause countdown stays current. */
function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function PumpPage() {
  const { selectedDevice, selectedTrial, profile } = useAuth()
  const { config, loading, error, refresh } = useDeviceConfig()
  const lastRun = useLastRun(selectedDevice)
  const now = useNow()

  if (!selectedDevice) return <Shell><p className="text-sm text-gray-500">No Argonaut assigned to your account yet.</p></Shell>
  if (!config) {
    return (
      <Shell>
        {error && <div className="text-sm text-red-500">{error}</div>}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {loading ? 'Loading…' : 'Waiting for Argonaut to report its settings. This usually takes about a minute.'}
        </div>
      </Shell>
    )
  }

  const system = (config.SYSTEM_TYPE ?? '').toUpperCase()
  const pausedUntil = config.PUMP_PAUSED_UNTIL ? new Date(config.PUMP_PAUSED_UNTIL) : null
  const paused = pausedUntil !== null && pausedUntil.getTime() > now
  const isAdmin = !!profile?.is_admin

  return (
    <Shell>
      <ModeCard system={system} config={config} paused={paused} pausedUntil={pausedUntil} now={now} lastRun={lastRun} />

      {/* Controls send commands -- admin-only until every tester unit runs command_consumer (same gate as Settings) */}
      {isAdmin && (
        <>
          <PauseCard
            deviceId={selectedDevice}
            trial={selectedTrial}
            paused={paused}
            pausedUntil={pausedUntil}
            system={system}
            onDone={refresh}
          />
          {system !== 'NFT' && (
            <CycleCard config={config} system={system} deviceId={selectedDevice} trial={selectedTrial} paused={paused} onDone={refresh} />
          )}
        </>
      )}
    </Shell>
  )
}

// ---------------------------------------------------------------------------

function ModeCard({
  system, config, paused, pausedUntil, now, lastRun,
}: {
  system: string
  config: DeviceConfig
  paused: boolean
  pausedUntil: Date | null
  now: number
  lastRun: LastRun | null
}) {
  const run = config.CIRC_DURATION_MINS
  const lead = config.CIRC_LEAD_MINS
  const description =
    system === 'NFT'
      ? 'Nutrient film: the pump runs continuously, 24/7. If flow stops, Argonaut restarts the pump within 5 minutes and alerts you if that fails.'
      : system === 'DWC'
        ? `Deep water culture: the air pump runs continuously, and the water pump runs ${run ?? '?'} min every hour.`
        : system === 'SWC'
          ? `Shallow water culture: every hour the air pump runs for ${lead ?? '?'} min, then the water pump runs for ${run ?? '?'} min.`
          : 'System type not set — choose it in Settings.'

  const minsLeft = pausedUntil ? Math.max(1, Math.ceil((pausedUntil.getTime() - now) / 60000)) : 0

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${paused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          <span className="text-sm font-medium text-gray-700">
            {paused
              ? `Paused — resumes at ${pausedUntil!.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${minsLeft} min)`
              : 'Automatic'}
          </span>
        </div>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{system || '—'}</span>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
      {lastRun && (
        <p className="text-xs text-gray-400">
          Last recorded run: {new Date(lastRun.datetime_utc).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {lastRun.pump_on_mins != null && ` · ${Math.round(lastRun.pump_on_mins)} min`}
          {lastRun.avg_rate_lpm != null && lastRun.avg_rate_lpm > 0 && ` · ${lastRun.avg_rate_lpm.toFixed(1)} L/min`}
          {' '}(updates hourly)
        </p>
      )}
    </section>
  )
}

function PauseCard({
  deviceId, trial, paused, pausedUntil, system, onDone,
}: {
  deviceId: string
  trial: string | null
  paused: boolean
  pausedUntil: Date | null
  system: string
  onDone: () => void
}) {
  const [minutes, setMinutes] = useState(30)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)
  const waiting = outcome?.state === 'waiting'

  async function send(command: 'pump_pause' | 'pump_resume') {
    await sendSettingsCommand(deviceId, command, command === 'pump_pause' ? { minutes } : {}, trial, o => {
      setOutcome(o)
      if (o.state === 'completed') onDone()
    })
  }

  return (
    <Card title="Maintenance pause">
      <p className="text-sm text-gray-500 -mt-1">
        Stop the pump while you clean the reservoir, change nutrients or fix a leak. It always turns back on
        by itself when the time is up{system === 'DWC' ? ' — the air pump keeps running throughout' : ''}.
      </p>

      {!paused ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            {PAUSE_OPTIONS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                aria-pressed={minutes === m}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                  minutes === m
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {m < 60 ? `${m} min` : `${m / 60} h`}
              </button>
            ))}
          </div>
          {system === 'NFT' && minutes >= 60 && (
            <p className="text-xs text-amber-600">
              NFT roots can dry out quickly without flow. Keep pauses as short as the job allows.
            </p>
          )}
          <button
            onClick={() => send('pump_pause')}
            disabled={waiting}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40"
          >
            {waiting ? 'Sending to Argonaut…' : `Pause pump for ${minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}`}
          </button>
        </>
      ) : (
        <button
          onClick={() => send('pump_resume')}
          disabled={waiting}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40"
        >
          {waiting
            ? 'Sending to Argonaut…'
            : `Resume now${pausedUntil ? ` (instead of ${pausedUntil.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})` : ''}`}
        </button>
      )}

      {waiting && <p className="text-xs text-amber-600">Waiting for Argonaut. Usually under a minute.</p>}
      {outcome?.state === 'failed' && <p className="text-xs text-red-500">{outcome.message}</p>}
    </Card>
  )
}

function CycleCard({
  config, system, deviceId, trial, paused, onDone,
}: {
  config: DeviceConfig
  system: string
  deviceId: string
  trial: string | null
  paused: boolean
  onDone: () => void
}) {
  const initial = {
    CIRC_DURATION_MINS: config.CIRC_DURATION_MINS ?? 4,
    CIRC_LEAD_MINS: config.CIRC_LEAD_MINS ?? 3,
  }
  const [draft, setDraft] = useState(initial)
  const [saveOutcome, setSaveOutcome] = useState<CommandOutcome | null>(null)
  const [runOutcome, setRunOutcome] = useState<CommandOutcome | null>(null)

  useEffect(() => {
    setDraft(initial)
  }, [config.CIRC_DURATION_MINS, config.CIRC_LEAD_MINS])

  const changes = diff(initial, draft)
  if (system !== 'SWC') delete changes.CIRC_LEAD_MINS          // lead time only applies to SWC
  const valid =
    Number.isInteger(draft.CIRC_DURATION_MINS) && draft.CIRC_DURATION_MINS >= 1 && draft.CIRC_DURATION_MINS <= 30 &&
    Number.isInteger(draft.CIRC_LEAD_MINS) && draft.CIRC_LEAD_MINS >= 0 && draft.CIRC_LEAD_MINS <= 15

  async function save() {
    await sendSettingsCommand(deviceId, 'update_grow_config', { changes }, trial, o => {
      setSaveOutcome(o)
      if (o.state === 'completed') onDone()
    })
  }

  async function runNow() {
    await sendSettingsCommand(deviceId, 'pump_run_cycle', {}, trial, setRunOutcome)
  }

  return (
    <Card title="Hourly cycle">
      <div className={`grid ${system === 'SWC' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
        <Field label="Pump run time (min)" hint="How long the water pump runs each hour.">
          <NumberInput value={draft.CIRC_DURATION_MINS} step={1} onChange={v => setDraft({ ...draft, CIRC_DURATION_MINS: v })} />
        </Field>
        {system === 'SWC' && (
          <Field label="Air lead time (min)" hint="Air pump runs this long before the water pump.">
            <NumberInput value={draft.CIRC_LEAD_MINS} step={1} onChange={v => setDraft({ ...draft, CIRC_LEAD_MINS: v })} />
          </Field>
        )}
      </div>
      <p className="text-xs text-gray-400">Changes apply from the next hourly cycle.</p>
      <SaveRow
        disabled={Object.keys(changes).length === 0 || !valid || saveOutcome?.state === 'waiting'}
        outcome={saveOutcome}
        onSave={save}
      />

      <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
        <button
          onClick={runNow}
          disabled={paused || runOutcome?.state === 'waiting'}
          className="w-full py-2.5 rounded-xl text-sm font-medium border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-40"
        >
          {runOutcome?.state === 'waiting' ? 'Sending to Argonaut…' : 'Run a cycle now'}
        </button>
        <p className="text-xs text-gray-400">
          {paused ? 'Resume the pump first.' : 'Useful after topping up the reservoir. Runs one normal cycle, then returns to the hourly schedule.'}
        </p>
        {runOutcome?.state === 'completed' && <p className="text-xs text-emerald-600">Cycle started on Argonaut ✓</p>}
        {runOutcome?.state === 'failed' && <p className="text-xs text-red-500">{runOutcome.message}</p>}
      </div>
    </Card>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-700">Pump</h1>
      {children}
    </div>
  )
}
