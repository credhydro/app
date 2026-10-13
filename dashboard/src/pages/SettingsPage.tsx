import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, Field, NumberInput, SaveRow, diff, inputCls } from '../components/FormBits'
import {
  useDeviceConfig,
  sendSettingsCommand,
  type CommandOutcome,
  type DeviceConfig,
} from '../hooks/useDeviceConfig'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const SYSTEM_TYPES: { value: string; label: string; pump: string }[] = [
  { value: 'NFT', label: 'NFT — Nutrient Film Technique', pump: 'runs the pump continuously, 24/7' },
  { value: 'DWC', label: 'DWC — Deep Water Culture', pump: 'runs the pump on a schedule and the air pump continuously' },
  { value: 'SWC', label: 'SWC — Shallow Water Culture', pump: 'runs the pump on a schedule' },
]

const US_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
]

function allTimezones(): string[] {
  // Intl.supportedValuesOf is ES2022; older browsers just get the US list.
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  const all = intl.supportedValuesOf?.('timeZone') ?? []
  return [...US_TIMEZONES, ...all.filter(z => !US_TIMEZONES.includes(z))]
}

const GROW_MEDIA = ['None (NFT/DWC)', 'Rockwool', 'Coco coir', 'Clay pebbles', 'Perlite', 'Other']

/** Turn "(540) 555-1234", "540-555-1234" or "+1 540…" into +15405551234. */
function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '')
  if (input.trim().startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function formatHour(h: number): string {
  const suffix = h < 12 ? 'am' : 'pm'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}${suffix}`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SettingsPage() {
  const { selectedDevice, selectedTrial, profile } = useAuth()
  const { config, updatedAt, pending, loading, error, refresh } = useDeviceConfig()

  if (!selectedDevice) {
    return (
      <PageShell>
        <Card title="No Argonaut assigned">
          <p className="text-sm text-gray-500">
            Your account isn't linked to an Argonaut unit yet. Contact Credible Hydroponics to get set up.
          </p>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      {error && <div className="text-sm text-red-500">{error}</div>}

      {!config && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {loading
            ? 'Loading settings…'
            : pending
              ? 'Waiting for Argonaut to report its current settings. This usually takes about a minute.'
              : "Argonaut hasn't reported its settings yet."}
        </div>
      )}

      {config && (
        <>
          <ContactSection
            config={config}
            deviceId={selectedDevice}
            trial={selectedTrial}
            onDone={refresh}
          />
          <SystemSection
            config={config}
            deviceId={selectedDevice}
            trial={selectedTrial}
            onDone={refresh}
          />
          <EnergySection
            config={config}
            deviceId={selectedDevice}
            trial={selectedTrial}
            onDone={refresh}
          />
          <StatusSection config={config} isAdmin={!!profile?.is_admin} />
          {updatedAt && (
            <p className="text-xs text-gray-400">
              Last reported by Argonaut {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </PageShell>
  )
}

interface SectionProps {
  config: DeviceConfig
  deviceId: string
  trial: string | null
  onDone: () => void
}

// ---------------------------------------------------------------------------
// Grower contact -- stored only on the Pi; Supabase only ever sees it masked
// ---------------------------------------------------------------------------

function ContactSection({ config, deviceId, trial, onDone }: SectionProps) {
  const [name, setName] = useState(config.GROWER_NAME ?? '')
  const [phone, setPhone] = useState('')
  const [sms, setSms] = useState(config.SMS_ALERTS ?? true)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)

  useEffect(() => {
    setName(config.GROWER_NAME ?? '')
    setSms(config.SMS_ALERTS ?? true)
  }, [config.GROWER_NAME, config.SMS_ALERTS])

  const normalized = phone ? normalizePhone(phone) : null
  const hasPhoneOnFile = !!config.GROWER_PHONE_MASKED
  // The Pi stores name + phone + SMS together, so every contact save includes the number.
  const canSave = name.trim().length > 0 && normalized !== null && outcome?.state !== 'waiting'

  async function save() {
    if (!normalized) return
    await sendSettingsCommand(
      deviceId,
      'set_grower_contact',
      { name: name.trim(), phone: normalized, sms_alerts: sms },
      trial,
      o => {
        setOutcome(o)
        if (o.state === 'completed') {
          setPhone('')
          onDone()
        }
      },
    )
  }

  return (
    <Card title="Grower contact">
      <Field label="Name">
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} maxLength={80} />
      </Field>

      <Field
        label="Mobile number"
        hint={
          hasPhoneOnFile
            ? `On file: ${config.GROWER_PHONE_MASKED}. Re-enter your number to save any change here.`
            : 'Used for text alerts when something needs your attention.'
        }
      >
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(540) 555-1234"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className={inputCls}
        />
        {phone && !normalized && (
          <p className="text-xs text-red-500 mt-1">Enter a 10-digit US number, or include the country code (+44…).</p>
        )}
      </Field>

      <label className="flex items-center gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={sms}
          onChange={e => setSms(e.target.checked)}
          className="w-4 h-4 rounded accent-emerald-500"
        />
        Text me about critical problems
      </label>

      <p className="text-xs text-gray-400">
        Your number is stored only on your Argonaut, not in the cloud.
      </p>

      <SaveRow disabled={!canSave} outcome={outcome} onSave={save} />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// System -- includes the system type confirmation
// ---------------------------------------------------------------------------

function SystemSection({ config, deviceId, trial, onDone }: SectionProps) {
  const timezones = useMemo(allTimezones, [])
  const initial = {
    SYSTEM_TYPE: config.SYSTEM_TYPE ?? 'NFT',
    TIMEZONE: config.TIMEZONE ?? 'America/New_York',
    // the unit template ships GROW_MEDIUM = "null" as a placeholder
    GROW_MEDIUM: config.GROW_MEDIUM && config.GROW_MEDIUM !== 'null' ? config.GROW_MEDIUM : '',
    PLANT_COUNT: config.PLANT_COUNT ?? 0,
    SYSTEM_VOLUME_GAL: config.SYSTEM_VOLUME_GAL ?? 0,
  }
  const [draft, setDraft] = useState(initial)
  const [confirming, setConfirming] = useState(false)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)

  useEffect(() => {
    setDraft(initial)
  }, [config.SYSTEM_TYPE, config.TIMEZONE, config.GROW_MEDIUM, config.PLANT_COUNT, config.SYSTEM_VOLUME_GAL])

  const changes = diff(initial, draft)
  const systemTypeChanged = 'SYSTEM_TYPE' in changes
  const valid =
    Number.isInteger(draft.PLANT_COUNT) && draft.PLANT_COUNT >= 0 && draft.PLANT_COUNT <= 1000 &&
    draft.SYSTEM_VOLUME_GAL >= 0.5 && draft.SYSTEM_VOLUME_GAL <= 1000 &&
    draft.GROW_MEDIUM.trim().length > 0

  async function send() {
    setConfirming(false)
    const params: Record<string, unknown> = { changes }
    if (systemTypeChanged) params.confirm_system_type = true
    await sendSettingsCommand(deviceId, 'update_grow_config', params, trial, o => {
      setOutcome(o)
      if (o.state === 'completed') onDone()
    })
  }

  const from = SYSTEM_TYPES.find(s => s.value === initial.SYSTEM_TYPE)
  const to = SYSTEM_TYPES.find(s => s.value === draft.SYSTEM_TYPE)

  return (
    <Card title="System">
      <Field label="Hydroponic system type">
        <select
          value={draft.SYSTEM_TYPE}
          onChange={e => setDraft({ ...draft, SYSTEM_TYPE: e.target.value })}
          className={inputCls}
        >
          {SYSTEM_TYPES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Timezone" hint="Light schedule hours follow this timezone.">
        <select
          value={draft.TIMEZONE}
          onChange={e => setDraft({ ...draft, TIMEZONE: e.target.value })}
          className={inputCls}
        >
          {timezones.map(z => (
            <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </Field>

      <Field label="Grow medium">
        <select
          value={draft.GROW_MEDIUM}
          onChange={e => setDraft({ ...draft, GROW_MEDIUM: e.target.value })}
          className={inputCls}
        >
          {!draft.GROW_MEDIUM && <option value="">Select…</option>}
          {/* Keep a value set over SSH (e.g. "rockwool") selectable even if it isn't in the list */}
          {draft.GROW_MEDIUM && !GROW_MEDIA.includes(draft.GROW_MEDIUM) && (
            <option value={draft.GROW_MEDIUM}>{draft.GROW_MEDIUM}</option>
          )}
          {GROW_MEDIA.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Plant count">
          <NumberInput value={draft.PLANT_COUNT} step={1} onChange={v => setDraft({ ...draft, PLANT_COUNT: v })} />
        </Field>
        <Field label="Reservoir volume (gal)">
          <NumberInput value={draft.SYSTEM_VOLUME_GAL} step={0.5} onChange={v => setDraft({ ...draft, SYSTEM_VOLUME_GAL: v })} />
        </Field>
      </div>

      <SaveRow
        disabled={Object.keys(changes).length === 0 || !valid || outcome?.state === 'waiting'}
        outcome={outcome}
        onSave={() => (systemTypeChanged ? setConfirming(true) : send())}
      />

      {confirming && (
        <ConfirmDialog
          title="Change system type?"
          confirmLabel={`Yes, switch to ${draft.SYSTEM_TYPE}`}
          onCancel={() => setConfirming(false)}
          onConfirm={send}
        >
          <p>
            This changes how Argonaut runs your pump. <b>{initial.SYSTEM_TYPE}</b> {from?.pump}.{' '}
            <b>{draft.SYSTEM_TYPE}</b> {to?.pump}.
          </p>
          <p>
            If this doesn't match how your system is plumbed, roots can dry out or the reservoir can
            overflow. Only continue if you've changed your physical setup.
          </p>
        </ConfirmDialog>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Electricity
// ---------------------------------------------------------------------------

function EnergySection({ config, deviceId, trial, onDone }: SectionProps) {
  const initial = {
    PEAK_HOURS: config.PEAK_HOURS ?? [],
    PEAK_RATE_SUMMER: config.PEAK_RATE_SUMMER ?? 0,
    NONPEAK_RATE_SUMMER: config.NONPEAK_RATE_SUMMER ?? 0,
    PEAK_RATE_WINTER: config.PEAK_RATE_WINTER ?? 0,
    NONPEAK_RATE_WINTER: config.NONPEAK_RATE_WINTER ?? 0,
  }
  const [draft, setDraft] = useState(initial)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)
  useEffect(() => {
    setDraft(initial)
  }, [JSON.stringify(config.PEAK_HOURS), config.PEAK_RATE_SUMMER, config.NONPEAK_RATE_SUMMER,
      config.PEAK_RATE_WINTER, config.NONPEAK_RATE_WINTER])

  const changes = diff(initial, draft)
  const rates = [draft.PEAK_RATE_SUMMER, draft.NONPEAK_RATE_SUMMER, draft.PEAK_RATE_WINTER, draft.NONPEAK_RATE_WINTER]
  const valid = rates.every(r => r >= 0 && r <= 5)

  function toggleHour(h: number) {
    const set = new Set(draft.PEAK_HOURS)
    if (set.has(h)) set.delete(h)
    else set.add(h)
    setDraft({ ...draft, PEAK_HOURS: [...set].sort((a, b) => a - b) })
  }

  async function send() {
    await sendSettingsCommand(deviceId, 'update_grow_config', { changes }, trial, o => {
      setOutcome(o)
      if (o.state === 'completed') onDone()
    })
  }

  return (
    <Card title="Electricity rates">
      <p className="text-xs text-gray-400 -mt-1">
        From your electric bill, in $ per kWh. Used to calculate running cost.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Summer peak"><NumberInput value={draft.PEAK_RATE_SUMMER} step={0.01} onChange={v => setDraft({ ...draft, PEAK_RATE_SUMMER: v })} /></Field>
        <Field label="Summer off-peak"><NumberInput value={draft.NONPEAK_RATE_SUMMER} step={0.01} onChange={v => setDraft({ ...draft, NONPEAK_RATE_SUMMER: v })} /></Field>
        <Field label="Winter peak"><NumberInput value={draft.PEAK_RATE_WINTER} step={0.01} onChange={v => setDraft({ ...draft, PEAK_RATE_WINTER: v })} /></Field>
        <Field label="Winter off-peak"><NumberInput value={draft.NONPEAK_RATE_WINTER} step={0.01} onChange={v => setDraft({ ...draft, NONPEAK_RATE_WINTER: v })} /></Field>
      </div>

      <Field label="Peak hours" hint="Tap the hours your utility charges the peak rate. Same rate all day? Leave all unselected.">
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
          {Array.from({ length: 24 }, (_, h) => {
            const on = draft.PEAK_HOURS.includes(h)
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggleHour(h)}
                aria-pressed={on}
                className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  on
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {formatHour(h)}
              </button>
            )
          })}
        </div>
      </Field>

      <SaveRow
        disabled={Object.keys(changes).length === 0 || !valid || outcome?.state === 'waiting'}
        outcome={outcome}
        onSave={send}
      />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Read-only status
// ---------------------------------------------------------------------------

function StatusSection({ config, isAdmin }: { config: DeviceConfig; isAdmin: boolean }) {
  const onHours = config.LIGHTS_ON_PERIOD ?? []
  const rows: [string, string][] = [
    ['Active trial', config.ACTIVE_TRIAL ?? '—'],
    ['Lights on', onHours.length ? `${onHours.length} h/day (${formatHour(onHours[0])} start)` : '—'],
    ['Target pH', config.TARGET_PH != null && config.PH_MAX_DELTA != null
      ? `${(config.TARGET_PH - config.PH_MAX_DELTA).toFixed(1)} – ${(config.TARGET_PH + config.PH_MAX_DELTA).toFixed(1)}`
      : '—'],
    ['pH down auto-doser', config.DOSER_DOWN_ENABLED ? 'On' : 'Off'],
    ['pH up auto-doser', config.DOSER_UP_ENABLED ? 'On' : 'Off'],
  ]
  if (isAdmin) rows.push(['Flow sensor', config.FLOW_SENSOR_INSTALLED ? 'Installed' : 'Not installed'])

  return (
    <Card title="Current status">
      <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{k}</dt>
            <dd className="text-gray-700 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-400">Change lights and pH settings on their own tabs.</p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-700">Settings</h1>
      {children}
    </div>
  )
}

function ConfirmDialog({
  title,
  confirmLabel,
  children,
  onCancel,
  onConfirm,
}: {
  title: string
  confirmLabel: string
  children: React.ReactNode
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-20 bg-black/30 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-lg max-w-md w-full p-5 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        <div className="text-sm text-gray-600 flex flex-col gap-2">{children}</div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
