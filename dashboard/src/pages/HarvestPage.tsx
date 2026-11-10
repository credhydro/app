import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendSettingsCommand, type CommandOutcome } from '../hooks/useDeviceConfig'
import { MAINTENANCE, day0Of, useGrow } from '../hooks/useGrow'
import { fmtDate } from '../components/GrowCard'

// Same keys as the unit's harvest_readiness.HARVEST_REASONS.
const REASONS: { key: string; label: string }[] = [
  { key: 'looks_ready', label: 'It looked big enough / ready' },
  { key: 'growth_slowing', label: 'Growth had slowed — not worth waiting longer' },
  { key: 'target_size', label: 'Reached a target size or weight' },
  { key: 'need_space', label: 'Needed the space for the next crop' },
  { key: 'schedule', label: 'Planned date / customer order' },
  { key: 'plant_problem', label: 'Bolting, disease, pests or another problem' },
  { key: 'other', label: 'Other' },
]
const GERMINATION = [
  { key: 'nursery', label: 'Nursery tray / germinated elsewhere' },
  { key: 'in_system', label: 'Germinated in this system' },
  { key: 'purchased', label: 'Bought as starts' },
]
const STEPS = ['Crop', 'Final photo', 'Weigh', 'Why now', 'Season', 'Review'] as const

interface PlantRow { plant_id: string; area: number | null; total: string; marketable: string; culled: boolean; note: string }
interface Draft {
  harvest_date: string
  crop_type: string; cultivar: string; sow_date: string; transplant_date: string; germination: string; plants_planted: string
  perPlant: boolean
  plants: PlantRow[]
  totals: { total: string; marketable: string; cull: string }
  reasons: string[]; reason_note: string
  pest: boolean; equip: boolean; labor: string; notes: string
  end_grow: boolean; confirm_overwrite: boolean
}

const today = () => new Date().toLocaleDateString('en-CA')          // YYYY-MM-DD, local
const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

function loadDraft(key: string): Draft | null {
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as Draft) : null } catch { return null }
}
function saveDraft(key: string, d: Draft) {
  try { localStorage.setItem(key, JSON.stringify(d)) } catch { /* private mode etc. -- the form still works */ }
}
function clearDraft(key: string) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

export function HarvestPage() {
  const { profile, selectedDevice, selectedTrial } = useAuth()
  const { active, trial, latestPhoto, configLoaded, refresh } = useGrow()
  const draftKey = `argonaut.harvestDraft.${selectedDevice}.${active}`
  const [step, setStep] = useState(0)
  const [d, setD] = useState<Draft | null>(null)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)

  // Start from a saved draft (e.g. after popping over to Growth Photos), else from the trial + last photo.
  useEffect(() => {
    if (d || !trial || !active) return
    const saved = loadDraft(draftKey)
    if (saved) { setD(saved); return }
    setD({
      harvest_date: today(),
      crop_type: trial.crop_type ?? '', cultivar: trial.cultivar ?? '',
      sow_date: trial.sow_date ?? '', transplant_date: day0Of(trial) ?? '', germination: trial.germination ?? '',
      plants_planted: trial.plant_count ? String(trial.plant_count) : '',
      perPlant: true,
      plants: (latestPhoto?.plants ?? []).slice().sort((a, b) => a.plant_id.localeCompare(b.plant_id))
        .map(p => ({ plant_id: p.plant_id, area: p.canopy_area_cm2, total: '', marketable: '', culled: false, note: '' })),
      totals: { total: '', marketable: '', cull: '' },
      reasons: [], reason_note: '', pest: false, equip: false, labor: '', notes: '',
      end_grow: true, confirm_overwrite: false,
    })
  }, [trial, active, latestPhoto, d, draftKey])
  useEffect(() => { if (d && outcome?.state !== 'completed') saveDraft(draftKey, d) }, [d, draftKey, outcome])

  const set = (patch: Partial<Draft>) => setD(prev => (prev ? { ...prev, ...patch } : prev))
  const totals = useMemo(() => {
    if (!d) return null
    if (!d.perPlant) return { total: num(d.totals.total), marketable: num(d.totals.marketable), cull: num(d.totals.cull) }
    const t = d.plants.reduce((a, p) => a + (num(p.total) || 0), 0)
    const m = d.plants.reduce((a, p) => a + (p.culled ? 0 : num(p.marketable) || 0), 0)
    const c = d.plants.reduce((a, p) => a + (p.culled ? num(p.total) || 0 : 0), 0)
    return { total: t, marketable: m, cull: c }
  }, [d])

  if (!profile?.is_admin) return <Shell><p className="text-sm text-gray-500">Harvest registration is admin-only for now.</p></Shell>
  // The result screen wins: after submitting, the unit is in maintenance and the draft is gone.
  if (outcome?.state === 'completed') return <Shell><Result result={outcome.result} /></Shell>
  if (!configLoaded) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>
  if (!active || active === MAINTENANCE) {
    return <Shell><p className="text-sm text-gray-600">There's no active grow to harvest — the unit is in maintenance. <Link to="/start-grow" className="text-emerald-700 hover:underline">Start a new grow →</Link></p></Shell>
  }
  if (!d || !totals) return <Shell><p className="text-sm text-gray-400">Loading {active}…</p></Shell>

  // ---- validation per step (Next is disabled with the reason shown) ----
  const problems: string[][] = [
    [
      !d.crop_type.trim() && 'Enter the crop.',
      !d.transplant_date && 'Enter the transplant date (day 0).',
      d.sow_date && d.transplant_date && d.sow_date > d.transplant_date && 'Sow date must be on or before the transplant date.',
      d.transplant_date && d.harvest_date < d.transplant_date && 'Harvest date must be on or after the transplant date.',
      !(num(d.plants_planted) >= 1) && 'Enter how many plants were planted.',
    ].filter(Boolean) as string[],
    [],
    (d.perPlant
      ? [
          d.plants.length === 0 && 'Add at least one plant.',
          d.plants.some(p => !p.plant_id.trim()) && 'Every plant needs an id.',
          new Set(d.plants.map(p => p.plant_id.trim())).size !== d.plants.length && 'A plant id is listed twice.',
          d.plants.some(p => !(num(p.total) >= 0)) && 'Enter a total weight for every plant.',
          d.plants.some(p => !p.culled && !(num(p.marketable) >= 0)) && 'Enter a marketable weight for every plant that isn’t culled.',
          d.plants.some(p => !p.culled && num(p.marketable) > num(p.total) * 1.05) && 'A marketable weight is more than that plant’s total.',
          d.plants.length > num(d.plants_planted) && 'More plants listed than were planted.',
        ]
      : [
          !(totals.total >= 0 && totals.marketable >= 0 && totals.cull >= 0) && 'Enter all three weights.',
          totals.marketable + totals.cull > totals.total * 1.05 && 'Marketable + cull weigh more than the total.',
        ]).filter(Boolean) as string[],
    [d.reasons.length === 0 && 'Pick at least one reason.'].filter(Boolean) as string[],
    [],
    [trial?.harvest_date && !d.confirm_overwrite && `${active} already has a harvest recorded — tick the box to replace it.`].filter(Boolean) as string[],
  ]

  function submit() {
    if (!selectedDevice || !d) return
    const params = {
      trial_name: active,
      harvest_date: d.harvest_date,
      crop_type: d.crop_type.trim(), cultivar: d.cultivar.trim() || null,
      sow_date: d.sow_date || null, transplant_date: d.transplant_date, germination: d.germination || null,
      plants_planted: num(d.plants_planted),
      plants: d.perPlant
        ? d.plants.map(p => ({ plant_id: p.plant_id.trim(), total_mass_g: num(p.total), marketable_mass_g: p.culled ? 0 : num(p.marketable), culled: p.culled, note: p.note.trim() || null }))
        : [],
      totals: d.perPlant ? null : { harvest_mass_g: totals!.total, marketable_mass_g: totals!.marketable, cull_mass_g: totals!.cull },
      reasons: d.reasons, reason_note: d.reason_note.trim() || null,
      pest_disease_event: d.pest, equipment_failure_event: d.equip,
      labor_hours_estimated: d.labor.trim() === '' ? null : num(d.labor),
      notes: d.notes.trim() || null, end_grow: d.end_grow, confirm_overwrite: d.confirm_overwrite,
    }
    sendSettingsCommand(selectedDevice, 'register_harvest', params, selectedTrial ?? active, o => {
      setOutcome(o)
      if (o.state === 'completed') { clearDraft(draftKey); refresh() }
    }, 4 * 60 * 1000)
  }

  const photoToday = latestPhoto && new Date(latestPhoto.captured_utc).toLocaleDateString('en-CA') === today()
  const blocking = problems[step]

  return (
    <Shell>
      <p className="text-sm text-gray-500 -mt-3">{active} · your answers are kept on this device until you submit.</p>
      <ol className="flex flex-wrap gap-1.5 text-xs">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button onClick={() => i < step && setStep(i)} disabled={i >= step}
              className={`rounded-full px-2.5 py-1 font-medium ${i === step ? 'bg-emerald-600 text-white' : i < step ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400'}`}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        {step === 0 && (
          <>
            <H>This crop</H>
            <p className="text-sm text-gray-500">Check the dates are this crop's own. Day 0 is the transplant date — growth and “days grown” count from it.</p>
            <Grid>
              <Field label="Harvest date"><input type="date" value={d.harvest_date} max={today()} onChange={e => set({ harvest_date: e.target.value })} className={inp} /></Field>
              <Field label="Crop"><input value={d.crop_type} onChange={e => set({ crop_type: e.target.value })} className={inp} placeholder="lettuce" /></Field>
              <Field label="Cultivar"><input value={d.cultivar} onChange={e => set({ cultivar: e.target.value })} className={inp} placeholder="Little Gem" /></Field>
              <Field label="Sow / germination date"><input type="date" value={d.sow_date} onChange={e => set({ sow_date: e.target.value })} className={inp} /></Field>
              <Field label="Transplant date (day 0)"><input type="date" value={d.transplant_date} onChange={e => set({ transplant_date: e.target.value })} className={inp} /></Field>
              <Field label="Germinated">
                <select value={d.germination} onChange={e => set({ germination: e.target.value })} className={inp}>
                  <option value="">—</option>
                  {GERMINATION.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
              </Field>
              <Field label="Plants planted"><input inputMode="numeric" value={d.plants_planted} onChange={e => set({ plants_planted: e.target.value })} className={inp} /></Field>
            </Grid>
          </>
        )}

        {step === 1 && (
          <>
            <H>Final growth photo</H>
            <p className="text-sm text-gray-600">
              Take one last growth photo before cutting anything, from the usual spot. It pairs each plant's canopy area with the
              weight you're about to measure — that's how Argonaut learns to estimate mass from photos.
            </p>
            {photoToday ? (
              <p className="text-sm text-emerald-700">✓ Photo accepted today ({new Date(latestPhoto!.captured_utc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}) — {latestPhoto!.plants.length} plants measured.</p>
            ) : (
              <p className="text-sm text-amber-700">
                {latestPhoto ? `Last accepted photo: ${new Date(latestPhoto.captured_utc).toLocaleDateString([], { month: 'short', day: 'numeric' })}.` : 'No accepted photo for this grow yet.'}{' '}
                Plants without a photo from the last week are saved without an area.
              </p>
            )}
            <Link to="/growth-photos" className="self-start text-sm font-medium text-emerald-700 hover:underline">Go to Growth Photos →</Link>
            <p className="text-xs text-gray-400">This page checks for the new photo every 30 seconds once you're back.</p>
          </>
        )}

        {step === 2 && (
          <>
            <H>Weigh</H>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
              <span className="font-medium text-gray-700">One plant at a time.</span> Total = the whole plant as it came out, roots and medium on.
              Marketable = what you'd sell, after cutting off roots and medium and trimming bad leaves. A culled plant is unsellable — weigh it whole.
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={d.perPlant} onChange={e => set({ perPlant: e.target.checked })} /> Weigh each plant separately (recommended)
            </label>
            {d.perPlant ? (
              <div className="flex flex-col gap-2">
                <div className="hidden md:grid grid-cols-[90px,90px,1fr,1fr,80px,32px] gap-2 text-xs text-gray-400 px-1">
                  <span>Plant</span><span>Area (photo)</span><span>Total (g)</span><span>Marketable (g)</span><span>Culled</span><span />
                </div>
                {d.plants.map((p, i) => {
                  const upd = (patch: Partial<PlantRow>) => set({ plants: d.plants.map((q, j) => (j === i ? { ...q, ...patch } : q)) })
                  return (
                    <div key={i} className="grid grid-cols-2 md:grid-cols-[90px,90px,1fr,1fr,80px,32px] gap-2 items-center rounded-lg border border-gray-100 p-2 md:border-0 md:p-0">
                      <input value={p.plant_id} onChange={e => upd({ plant_id: e.target.value })} className={inp} placeholder="R3C2" aria-label="Plant id" />
                      <span className="text-xs text-gray-500">{p.area ? `${Math.round(p.area)} cm²` : 'no photo'}</span>
                      <input inputMode="decimal" value={p.total} onChange={e => upd({ total: e.target.value })} className={inp} placeholder="total g" aria-label={`${p.plant_id} total grams`} />
                      <input inputMode="decimal" value={p.culled ? '' : p.marketable} disabled={p.culled} onChange={e => upd({ marketable: e.target.value })} className={inp} placeholder={p.culled ? 'culled' : 'marketable g'} aria-label={`${p.plant_id} marketable grams`} />
                      <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={p.culled} onChange={e => upd({ culled: e.target.checked })} /> Culled</label>
                      <button onClick={() => set({ plants: d.plants.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-500 text-sm" aria-label={`Remove ${p.plant_id}`}>✕</button>
                    </div>
                  )
                })}
                <button onClick={() => set({ plants: [...d.plants, { plant_id: '', area: null, total: '', marketable: '', culled: false, note: '' }] })}
                  className="self-start text-sm font-medium text-emerald-700 hover:underline">+ Add a plant</button>
              </div>
            ) : (
              <Grid>
                <Field label="Total harvest (g)"><input inputMode="decimal" value={d.totals.total} onChange={e => set({ totals: { ...d.totals, total: e.target.value } })} className={inp} /></Field>
                <Field label="Marketable (g)"><input inputMode="decimal" value={d.totals.marketable} onChange={e => set({ totals: { ...d.totals, marketable: e.target.value } })} className={inp} /></Field>
                <Field label="Cull (g)"><input inputMode="decimal" value={d.totals.cull} onChange={e => set({ totals: { ...d.totals, cull: e.target.value } })} className={inp} /></Field>
              </Grid>
            )}
            <p className="text-sm text-gray-600">
              Totals: <b>{fmtG(totals.total)}</b> total · <b>{fmtG(totals.marketable)}</b> marketable · {fmtG(totals.cull)} cull
              {Number.isFinite(totals.total - totals.marketable - totals.cull) && ` · ${fmtG(totals.total - totals.marketable - totals.cull)} trimmed off`}
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <H>Why harvest now?</H>
            <p className="text-sm text-gray-500">There's no single right answer — this is how Argonaut learns what “ready” means to you. Pick all that apply.</p>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map(r => {
                const on = d.reasons.includes(r.key)
                return (
                  <button key={r.key} type="button" aria-pressed={on}
                    onClick={() => set({ reasons: on ? d.reasons.filter(k => k !== r.key) : [...d.reasons, r.key] })}
                    className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-600'}`}>
                    {r.label}
                  </button>
                )
              })}
            </div>
            <Field label="Anything else about the timing? (optional)">
              <input value={d.reason_note} maxLength={300} onChange={e => set({ reason_note: e.target.value })} className={inp} placeholder="e.g. cilantro starts were ready to go in" />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <H>This grow</H>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={d.pest} onChange={e => set({ pest: e.target.checked })} /> Pest or disease problem during the grow</label>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={d.equip} onChange={e => set({ equip: e.target.checked })} /> Equipment failure during the grow (pump, sensor, dosing, lights…)</label>
            <Grid>
              <Field label="Routine care hours, whole grow (optional)">
                <input inputMode="decimal" value={d.labor} onChange={e => set({ labor: e.target.value })} className={inp} placeholder="e.g. 6" />
              </Field>
            </Grid>
            <p className="text-xs text-gray-400 -mt-2">Top-ups, checks, adjustments. Not today's harvest. A rough number is fine.</p>
            <Field label="Notes (optional)">
              <textarea rows={3} value={d.notes} maxLength={1000} onChange={e => set({ notes: e.target.value })} className={inp} placeholder="Anything worth remembering about this crop" />
            </Field>
          </>
        )}

        {step === 5 && (
          <>
            <H>Review</H>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-400">Crop</dt><dd className="text-gray-700">{[d.cultivar, d.crop_type].filter(Boolean).join(' ')} · {d.plants_planted} planted</dd>
              <dt className="text-gray-400">Dates</dt><dd className="text-gray-700">{d.sow_date ? `sown ${fmtDate(d.sow_date)} · ` : ''}transplanted {fmtDate(d.transplant_date)} · harvested {fmtDate(d.harvest_date)}</dd>
              <dt className="text-gray-400">Weights</dt><dd className="text-gray-700">{fmtG(totals.total)} total · {fmtG(totals.marketable)} marketable · {fmtG(totals.cull)} cull{d.perPlant ? ` · ${d.plants.length} plants weighed` : ''}</dd>
              <dt className="text-gray-400">Why now</dt><dd className="text-gray-700">{d.reasons.map(k => REASONS.find(r => r.key === k)?.label).join('; ')}</dd>
              <dt className="text-gray-400">Grow</dt><dd className="text-gray-700">{[d.pest && 'pest/disease', d.equip && 'equipment failure'].filter(Boolean).join(', ') || 'no problems noted'}{d.labor ? ` · ${d.labor} h care` : ''}</dd>
            </dl>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5" checked={d.end_grow} onChange={e => set({ end_grow: e.target.checked })} />
              <span>End this grow — switch the unit to maintenance. <span className="text-gray-400">Start the next grow afterwards (e.g. when the new crop goes in).</span></span>
            </label>
            {trial?.harvest_date && (
              <label className="flex items-start gap-2 text-sm text-amber-800">
                <input type="checkbox" className="mt-0.5" checked={d.confirm_overwrite} onChange={e => set({ confirm_overwrite: e.target.checked })} />
                <span>{active} already has a harvest on {fmtDate(trial.harvest_date)}. Replace it.</span>
              </label>
            )}
          </>
        )}

        {blocking.length > 0 && <ul className="text-sm text-amber-700 list-disc pl-5">{blocking.map(b => <li key={b}>{b}</li>)}</ul>}
        {outcome?.state === 'failed' && <p className="text-sm text-red-600">Not saved: {outcome.message}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {step > 0 && <button onClick={() => setStep(step - 1)} disabled={outcome?.state === 'waiting'} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 disabled:opacity-40">Back</button>}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} disabled={blocking.length > 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {step === 1 && !photoToday ? 'Continue without a new photo' : 'Next'}
            </button>
          ) : (
            <button onClick={submit} disabled={blocking.length > 0 || outcome?.state === 'waiting'} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {outcome?.state === 'waiting' ? 'Saving on Argonaut… (up to a minute)' : 'Register harvest'}
            </button>
          )}
        </div>
      </section>
    </Shell>
  )
}

function Result({ result }: { result: Record<string, unknown> | null }) {
  const r = (result ?? {}) as {
    trial_name?: string; harvest_mass_g?: number; marketable_mass_g?: number; cull_mass_g?: number; ended_grow?: string | null
    summary?: { days_grown?: number; marketable_g_per_plant?: number; marketable_g_per_plant_per_day?: number | null
      plants?: { plant_id: string; total_mass_g: number; marketable_mass_g: number; culled: boolean; canopy_area_cm2: number | null; g_per_cm2: number | null }[] }
  }
  const s = r.summary ?? {}
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <H>Harvest registered — {r.trial_name}</H>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Marketable" value={fmtG(r.marketable_mass_g)} />
        <Stat label="Total" value={fmtG(r.harvest_mass_g)} />
        <Stat label="Days grown" value={s.days_grown != null ? String(s.days_grown) : '—'} />
        <Stat label="Marketable / plant" value={fmtG(s.marketable_g_per_plant)} />
      </div>
      {s.plants && s.plants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400"><th className="py-1 pr-3 font-medium">Plant</th><th className="py-1 pr-3 font-medium">Total</th><th className="py-1 pr-3 font-medium">Marketable</th><th className="py-1 pr-3 font-medium">Area</th><th className="py-1 font-medium">g per cm²</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {s.plants.map(p => (
                <tr key={p.plant_id} className="text-gray-700">
                  <td className="py-1 pr-3">{p.plant_id}</td><td className="py-1 pr-3">{fmtG(p.total_mass_g)}</td>
                  <td className="py-1 pr-3">{p.culled ? 'culled' : fmtG(p.marketable_mass_g)}</td>
                  <td className="py-1 pr-3">{p.canopy_area_cm2 ? `${Math.round(p.canopy_area_cm2)} cm²` : '—'}</td>
                  <td className="py-1">{p.g_per_cm2 ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-gray-400">g per cm² = total weight ÷ canopy area in the last photo — the first data for estimating weight from photos.</p>
        </div>
      )}
      <p className="text-sm text-gray-600">{r.ended_grow ? 'The unit is now in maintenance. ' : ''}Cost per gram comes later, once the trial is compiled.</p>
      <div className="flex flex-wrap gap-2">
        <Link to="/start-grow" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Start the next grow →</Link>
        <Link to="/" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600">Home</Link>
      </div>
    </section>
  )
}

const inp = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 disabled:bg-gray-50'
function fmtG(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 10) / 10} g`
}
function H({ children }: { children: React.ReactNode }) { return <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{children}</h2> }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-3 sm:grid-cols-2">{children}</div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs font-medium text-gray-500">{label}</span>{children}</label>
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-gray-50 p-3"><div className="text-xs text-gray-400">{label}</div><div className="text-lg font-semibold text-gray-700">{value}</div></div>
}
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-8 flex flex-col gap-6 max-w-3xl"><h1 className="text-xl font-semibold text-gray-700">Register harvest</h1>{children}</div>
}
