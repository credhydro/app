import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendSettingsCommand, type CommandOutcome } from '../hooks/useDeviceConfig'
import { MAINTENANCE, suggestTrialName, useGrow } from '../hooks/useGrow'
import { fmtDate } from '../components/GrowCard'

const HARVEST_TYPES = [
  { key: 'single_cut', label: 'Single cut — harvest the whole plant once' },
  { key: 'cut_and_come_again', label: 'Cut and come again — several cuts from the same plants' },
  { key: 'continuous', label: 'Continuous — pick as it grows' },
]
const GERMINATION = [
  { key: 'nursery', label: 'Nursery tray / germinated elsewhere' },
  { key: 'in_system', label: 'Germinated in this system' },
  { key: 'purchased', label: 'Bought as starts' },
]
const today = () => new Date().toLocaleDateString('en-CA')

export function StartGrowPage() {
  const { profile, selectedDevice } = useAuth()
  const { active, trial, trialNames, configLoaded, refresh } = useGrow()
  const [f, setF] = useState({
    trial_name: '', crop_type: '', cultivar: '', sow_date: '', transplant_date: today(), germination: 'nursery',
    plant_count: '', harvest_type: 'single_cut', grow_medium: '', harvest_target: '', notes: '', replace_active: false,
  })
  const [nameTouched, setNameTouched] = useState(false)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)
  const set = (patch: Partial<typeof f>) => setF(prev => ({ ...prev, ...patch }))

  useEffect(() => {
    if (!nameTouched && trialNames.length) setF(prev => ({ ...prev, trial_name: suggestTrialName(trialNames) }))
  }, [trialNames, nameTouched])

  if (!profile?.is_admin) return <Shell><p className="text-sm text-gray-500">Starting a grow is admin-only for now.</p></Shell>
  if (outcome?.state === 'completed') {
    const r = (outcome.result ?? {}) as { trial_name?: string; transplant_date?: string; previous_active_trial?: string }
    return (
      <Shell>
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{r.trial_name} started</h2>
          <p className="text-sm text-gray-700">
            {r.trial_name} is now the active grow. Day 0 = {fmtDate(r.transplant_date)}. Everything Argonaut logs from now on is filed under it.
          </p>
          <p className="text-sm text-gray-600">Take the first growth photo in the next day or two — it starts the growth chart.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/growth-photos" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Growth Photos →</Link>
            <Link to="/" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600">Home</Link>
          </div>
        </section>
      </Shell>
    )
  }

  if (!configLoaded) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>

  const activeUnharvested = !!active && active !== MAINTENANCE && !trial?.harvest_date
  const nameOk = /^[a-z0-9][a-z0-9_-]{2,39}$/.test(f.trial_name)
  const problems = [
    !nameOk && 'Name: 3–40 characters, lower-case letters, numbers, _ or - (e.g. trial_004).',
    nameOk && trialNames.includes(f.trial_name) && `“${f.trial_name}” is already used — every crop gets a new name.`,
    !f.crop_type.trim() && 'Enter the crop.',
    !f.transplant_date && 'Enter the transplant date.',
    f.transplant_date > today() && 'The transplant date can’t be in the future.',
    f.sow_date && f.transplant_date && f.sow_date > f.transplant_date && 'Sow date must be on or before the transplant date.',
    !(Number(f.plant_count) >= 1) && 'Enter how many plants.',
    activeUnharvested && !f.replace_active && `${active} is still the active grow and hasn’t been harvested.`,
  ].filter(Boolean) as string[]

  function submit() {
    if (!selectedDevice) return
    sendSettingsCommand(selectedDevice, 'start_grow', {
      trial_name: f.trial_name, crop_type: f.crop_type.trim(), cultivar: f.cultivar.trim() || null,
      sow_date: f.sow_date || null, transplant_date: f.transplant_date, germination: f.germination || null,
      plant_count: Number(f.plant_count), harvest_type: f.harvest_type, grow_medium: f.grow_medium.trim() || null,
      harvest_target: f.harvest_target.trim() || null, notes: f.notes.trim() || null, replace_active: f.replace_active,
    }, null, o => { setOutcome(o); if (o.state === 'completed') refresh() })  // null: commands.trial_name must already exist in trials, and this grow does not yet
  }

  return (
    <Shell>
      <p className="text-sm text-gray-500 -mt-3">One grow per crop. The transplant date is day 0 for growth, days grown and harvest records.</p>
      {activeUnharvested && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex flex-col gap-2">
          <span><b>{active}</b> is still the active grow and has no harvest recorded. Usually you'd <Link to="/harvest" className="font-medium underline">register its harvest</Link> first.</span>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.replace_active} onChange={e => set({ replace_active: e.target.checked })} /> Start the new grow anyway (it stays unharvested)</label>
        </div>
      )}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grow name"><input value={f.trial_name} onChange={e => { setNameTouched(true); set({ trial_name: e.target.value.toLowerCase() }) }} className={inp} /></Field>
          <Field label="Crop"><input value={f.crop_type} onChange={e => set({ crop_type: e.target.value })} className={inp} placeholder="cilantro" /></Field>
          <Field label="Cultivar (optional)"><input value={f.cultivar} onChange={e => set({ cultivar: e.target.value })} className={inp} placeholder="e.g. Santo" /></Field>
          <Field label="Plants"><input inputMode="numeric" value={f.plant_count} onChange={e => set({ plant_count: e.target.value })} className={inp} /></Field>
          <Field label="Sow / germination date (optional)"><input type="date" value={f.sow_date} max={today()} onChange={e => set({ sow_date: e.target.value })} className={inp} /></Field>
          <Field label="Transplant date (day 0)"><input type="date" value={f.transplant_date} max={today()} onChange={e => set({ transplant_date: e.target.value })} className={inp} /></Field>
          <Field label="Germinated">
            <select value={f.germination} onChange={e => set({ germination: e.target.value })} className={inp}>
              {GERMINATION.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </Field>
          <Field label="Harvest type">
            <select value={f.harvest_type} onChange={e => set({ harvest_type: e.target.value })} className={inp}>
              {HARVEST_TYPES.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
            </select>
          </Field>
          <Field label="Grow medium (optional)"><input value={f.grow_medium} onChange={e => set({ grow_medium: e.target.value })} className={inp} placeholder="rockwool" /></Field>
          <Field label="Harvest target (optional)"><input value={f.harvest_target} maxLength={200} onChange={e => set({ harvest_target: e.target.value })} className={inp} placeholder="e.g. first cut at ~5 weeks" /></Field>
        </div>
        <Field label="Notes (optional)"><textarea rows={2} value={f.notes} maxLength={1000} onChange={e => set({ notes: e.target.value })} className={inp} /></Field>
        <p className="text-xs text-gray-400">Light, pH and EC setpoints are captured from the unit's current settings.</p>
        {problems.length > 0 && <ul className="text-sm text-amber-700 list-disc pl-5">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
        {outcome?.state === 'failed' && <p className="text-sm text-red-600">Not started: {outcome.message}</p>}
        <button onClick={submit} disabled={problems.length > 0 || outcome?.state === 'waiting'}
          className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          {outcome?.state === 'waiting' ? 'Starting on Argonaut… (up to a minute)' : `Start ${f.trial_name || 'grow'}`}
        </button>
      </section>
    </Shell>
  )
}

const inp = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs font-medium text-gray-500">{label}</span>{children}</label>
}
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-8 flex flex-col gap-6 max-w-3xl"><h1 className="text-xl font-semibold text-gray-700">Start a new grow</h1>{children}</div>
}
