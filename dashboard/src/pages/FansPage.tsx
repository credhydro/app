import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useDeviceConfig, sendSettingsCommand, type CommandOutcome, type DeviceConfig } from '../hooks/useDeviceConfig'
import { Card, Field, NumberInput, SaveRow, diff } from '../components/FormBits'

const BOOST_OPTIONS = [15, 30, 60, 120]
const OFF_OPTIONS = [30, 60, 120, 240]

function fmtMins(m: number): string {
  return m < 60 ? `${m} min` : `${m / 60} h`
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

interface LastRun { datetime_utc: string; on_mins: number | null }

/** Most recent logged fan run (rows sync from the Pi hourly). */
function useLastFanRun(deviceId: string | null): LastRun | null {
  const [row, setRow] = useState<LastRun | null>(null)
  useEffect(() => {
    if (!deviceId) return
    let cancelled = false
    async function load() {
      const res = await supabase
        .from('fan')
        .select('datetime_utc, on_mins')
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

function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function FansPage() {
  const { selectedDevice, selectedTrial } = useAuth()
  const { config, loading, error, refresh } = useDeviceConfig()
  const lastRun = useLastFanRun(selectedDevice)
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

  const until = config.FAN_OVERRIDE_UNTIL ? new Date(config.FAN_OVERRIDE_UNTIL) : null
  const override = until && until.getTime() > now && config.FAN_OVERRIDE_MODE ? { mode: config.FAN_OVERRIDE_MODE, until } : null

  return (
    <Shell>
      <StatusCard config={config} override={override} now={now} lastRun={lastRun} />
      <OverrideCard deviceId={selectedDevice} trial={selectedTrial} override={override} onDone={refresh} />
      <ScheduleCard config={config} deviceId={selectedDevice} trial={selectedTrial} onDone={refresh} />
    </Shell>
  )
}

function scheduleText(c: DeviceConfig): string {
  const on = c.FAN_ON_MINS ?? 10
  const cycle = c.FAN_CYCLE_MINS ?? 60
  const lightsOnly = c.FAN_LIGHTS_ON_ONLY !== false && c.LIGHTS_INSTALLED !== false
  if (on <= 0) return 'The automatic fan cycle is turned off.'
  const when = lightsOnly ? ' while the grow lights are on' : ', day and night'
  if (on >= cycle) return `Runs continuously${when}.`
  return `Runs ${on} min every ${cycle === 60 ? 'hour' : `${cycle} min`}${when}.`
}

function StatusCard({ config, override, now, lastRun }: {
  config: DeviceConfig
  override: { mode: 'on' | 'off'; until: Date } | null
  now: number
  lastRun: LastRun | null
}) {
  const minsLeft = override ? Math.max(1, Math.ceil((override.until.getTime() - now) / 60000)) : 0
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full ${override?.mode === 'on' ? 'bg-blue-400' : override?.mode === 'off' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        <span className="text-sm font-medium text-gray-700">
          {override
            ? `${override.mode === 'on' ? 'Boost — on' : 'Off'} until ${fmtTime(override.until)} (${minsLeft} min), then automatic`
            : 'Automatic'}
        </span>
      </div>
      <p className="text-sm text-gray-500">{scheduleText(config)}</p>
      {lastRun && (
        <p className="text-xs text-gray-400">
          Last recorded run: {new Date(lastRun.datetime_utc).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {lastRun.on_mins != null && ` · ${Math.round(lastRun.on_mins)} min`} (updates hourly)
        </p>
      )}
    </section>
  )
}

function OverrideCard({ deviceId, trial, override, onDone }: {
  deviceId: string
  trial: string | null
  override: { mode: 'on' | 'off'; until: Date } | null
  onDone: () => void
}) {
  const [boost, setBoost] = useState(30)
  const [off, setOff] = useState(60)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)
  const waiting = outcome?.state === 'waiting'

  async function send(command: 'fan_override' | 'fan_auto', params: Record<string, unknown>) {
    await sendSettingsCommand(deviceId, command, params, trial, o => {
      setOutcome(o)
      if (o.state === 'completed') onDone()
    })
  }

  return (
    <Card title="Manual control">
      <p className="text-sm text-gray-500 -mt-1">Run the fan or switch it off for a while. It goes back to automatic by itself.</p>

      <Choice label="Run the fan for" options={BOOST_OPTIONS} value={boost} onChange={setBoost} color="blue" />
      <button
        onClick={() => send('fan_override', { mode: 'on', minutes: boost })}
        disabled={waiting}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40"
      >
        Boost for {fmtMins(boost)}
      </button>

      <Choice label="Turn the fan off for" options={OFF_OPTIONS} value={off} onChange={setOff} color="amber" />
      <button
        onClick={() => send('fan_override', { mode: 'off', minutes: off })}
        disabled={waiting}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40"
      >
        Off for {fmtMins(off)}
      </button>

      {override && (
        <button
          onClick={() => send('fan_auto', {})}
          disabled={waiting}
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40"
        >
          Back to automatic now
        </button>
      )}

      {waiting && <p className="text-xs text-amber-600">Waiting for Argonaut. Usually under a minute.</p>}
      {outcome?.state === 'failed' && <p className="text-xs text-red-500">{outcome.message}</p>}
    </Card>
  )
}

function Choice({ label, options, value, onChange, color }: {
  label: string
  options: number[]
  value: number
  onChange: (v: number) => void
  color: 'blue' | 'amber'
}) {
  const active = color === 'blue' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-amber-500 border-amber-500 text-white'
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <div className="grid grid-cols-4 gap-2">
        {options.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={value === m}
            className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
              value === m ? active : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {fmtMins(m)}
          </button>
        ))}
      </div>
    </div>
  )
}

function ScheduleCard({ config, deviceId, trial, onDone }: {
  config: DeviceConfig
  deviceId: string
  trial: string | null
  onDone: () => void
}) {
  const initial = {
    FAN_ON_MINS: config.FAN_ON_MINS ?? 10,
    FAN_CYCLE_MINS: config.FAN_CYCLE_MINS ?? 60,
    FAN_LIGHTS_ON_ONLY: config.FAN_LIGHTS_ON_ONLY !== false,
    FAN_WATTS: config.FAN_WATTS ?? 25,
  }
  const [draft, setDraft] = useState(initial)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)

  useEffect(() => {
    setDraft(initial)
  }, [config.FAN_ON_MINS, config.FAN_CYCLE_MINS, config.FAN_LIGHTS_ON_ONLY, config.FAN_WATTS])

  const changes = diff(initial, draft)
  const valid =
    Number.isInteger(draft.FAN_ON_MINS) && draft.FAN_ON_MINS >= 0 &&
    Number.isInteger(draft.FAN_CYCLE_MINS) && draft.FAN_CYCLE_MINS >= 5 && draft.FAN_CYCLE_MINS <= 240 &&
    draft.FAN_ON_MINS <= draft.FAN_CYCLE_MINS &&
    draft.FAN_WATTS >= 0 && draft.FAN_WATTS <= 2000
  const noLeds = config.LIGHTS_INSTALLED === false

  async function save() {
    await sendSettingsCommand(deviceId, 'update_grow_config', { changes }, trial, o => {
      setOutcome(o)
      if (o.state === 'completed') onDone()
    })
  }

  return (
    <Card title="Automatic cycle">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fan on (min)" hint="Set equal to the cycle to run continuously, 0 to stop the cycle.">
          <NumberInput value={draft.FAN_ON_MINS} step={1} onChange={v => setDraft({ ...draft, FAN_ON_MINS: v })} />
        </Field>
        <Field label="Every (min)" hint="Cycles start on the hour, e.g. 10 of 60 runs :00–:10.">
          <NumberInput value={draft.FAN_CYCLE_MINS} step={5} onChange={v => setDraft({ ...draft, FAN_CYCLE_MINS: v })} />
        </Field>
      </div>
      {draft.FAN_ON_MINS > draft.FAN_CYCLE_MINS && (
        <p className="text-xs text-red-500">"Fan on" can't be longer than the cycle.</p>
      )}

      <label className={`flex items-center gap-3 text-sm ${noLeds ? 'text-gray-400' : 'text-gray-700'}`}>
        <input
          type="checkbox"
          checked={draft.FAN_LIGHTS_ON_ONLY && !noLeds}
          disabled={noLeds}
          onChange={e => setDraft({ ...draft, FAN_LIGHTS_ON_ONLY: e.target.checked })}
          className="w-4 h-4 rounded accent-emerald-500"
        />
        Only run while the grow lights are on
      </label>
      {noLeds && <p className="text-xs text-gray-400 -mt-2">No grow lights are set up, so the fan cycle runs all day.</p>}

      <Field label="Fan power (W)" hint="Total for all fans. Used for energy cost.">
        <NumberInput value={draft.FAN_WATTS} step={1} onChange={v => setDraft({ ...draft, FAN_WATTS: v })} />
      </Field>

      <SaveRow disabled={Object.keys(changes).length === 0 || !valid || outcome?.state === 'waiting'} outcome={outcome} onSave={save} />
    </Card>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-700">Fans</h1>
      {children}
    </div>
  )
}
