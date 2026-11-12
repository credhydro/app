import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { sendSettingsCommand, useDeviceConfig, type CommandOutcome } from '../hooks/useDeviceConfig'
import { formatTemp, tempUnit, type TempUnit } from '../lib/units'
import { useTrialFeedback, type FeedbackTopic, type TrialReview, type ReviewFacts } from '../hooks/useTrialFeedback'
import { everyLabel, useReminders } from '../hooks/useReminders'

const TOPIC: Record<FeedbackTopic, string> = {
  yield: 'Yield',
  climate: 'Climate',
  light_photosynthesis: 'Light & photosynthesis',
  nutrients_dosing: 'pH, EC & dosing',
  growth: 'Growth',
  energy_cost: 'Energy & cost',
  sensors_data: 'Sensors & data',
}
const VERDICT: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ok: 'bg-gray-50 text-gray-600 border-gray-200',
  watch: 'bg-amber-50 text-amber-800 border-amber-200',
  problem: 'bg-red-50 text-red-700 border-red-200',
}
const OVERALL: Record<TrialReview['overall'], string> = {
  strong: 'Strong grow', solid: 'Solid grow', mixed: 'Mixed grow', poor: 'Rough grow',
}
const BASIS: Record<string, string> = {
  this_grow: 'from this grow', past_grows: 'vs. your past grows', general_horticulture: 'general guidance',
}

/**
 * Argonaut's review of a finished grow. `waitSince` (ms): a review was just requested
 * (harvest registered / "Write it again"), so show "writing" until a newer one arrives.
 */
export function TrialFeedbackCard({ trialName, waitSince = null }: { trialName: string; waitSince?: number | null }) {
  const { profile, selectedDevice } = useAuth()
  const { config } = useDeviceConfig()
  const unit = tempUnit(config)
  const [requested, setRequested] = useState<number | null>(null)
  const [cmd, setCmd] = useState<CommandOutcome | null>(null)
  const since = requested ?? waitSince
  const { row, loading, error, writing, refresh } = useTrialFeedback(trialName, since)

  function rewrite() {
    if (!selectedDevice) return
    sendSettingsCommand(selectedDevice, 'generate_trial_feedback', { trial_name: trialName }, trialName, o => {
      setCmd(o)
      if (o.state === 'completed') { setRequested(Date.now()); refresh() }
    })
  }

  const review = row?.feedback ?? null
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Argonaut's review — {trialName}</h2>
        {review && <span className="text-xs text-gray-400">{OVERALL[review.overall] ?? review.overall}</span>}
      </div>

      {loading && !row && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {writing && (
        <p className="text-sm text-gray-600">
          Argonaut is going over the grow — climate, light, pH and EC, dosing, growth and cost. The review usually
          takes a minute or two; it appears here on its own.
        </p>
      )}
      {!writing && row?.status === 'failed' && (
        <p className="text-sm text-amber-800">The review couldn't be written{row.error ? `: ${row.error}` : '.'}</p>
      )}
      {!loading && !row && !writing && <p className="text-sm text-gray-500">No review for this grow yet.</p>}

      {review && (
        <>
          <p className="text-base font-semibold text-gray-800">{review.headline}</p>
          <KeyNumbers facts={row?.facts ?? null} unit={unit} />
          <p className="text-sm text-gray-700 leading-relaxed">{review.summary}</p>

          <div className="flex flex-col gap-3">
            {review.sections.map(s => (
              <div key={s.topic} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">{TOPIC[s.topic] ?? s.topic}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${VERDICT[s.verdict] ?? VERDICT.ok}`}>{s.verdict}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>

          {review.try_next_time.length > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-emerald-900">Try next time</h3>
              <ol className="flex flex-col gap-3 list-decimal pl-5">
                {review.try_next_time.map((t, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    <p className="font-medium text-gray-800">{t.suggestion}</p>
                    <p className="text-gray-600">{t.why}</p>
                    {t.expected_effect && <p className="text-gray-500">Expected: {t.expected_effect}</p>}
                    <p className="mt-0.5 text-xs text-gray-400">{t.confidence} confidence · {BASIS[t.basis] ?? t.basis}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {review.reminders && review.reminders.length > 0 && <ReminderOffers trialName={trialName} offers={review.reminders} />}

          {review.caveats && review.caveats.length > 0 && (
            <ul className="text-xs text-gray-400 list-disc pl-4 flex flex-col gap-0.5">
              {review.caveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
          <p className="text-xs text-gray-400">
            Written {new Date(row!.datetime_utc).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {' '}from this grow's data. Suggestions from a single grow are a starting point — they firm up as harvests add up.
          </p>
        </>
      )}

      {profile?.is_admin && !writing && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={rewrite} disabled={cmd?.state === 'waiting'}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            {cmd?.state === 'waiting' ? 'Asking Argonaut…' : row ? 'Write it again' : 'Write the review'}
          </button>
          {cmd?.state === 'failed' && <span className="text-xs text-red-600">{cmd.message}</span>}
        </div>
      )}
    </section>
  )
}

function ReminderOffers({ trialName, offers }: { trialName: string; offers: { text: string; every_days: number }[] }) {
  const { reminders, add } = useReminders()
  const [state, setState] = useState<Record<string, CommandOutcome>>({})
  const has = (t: string) => reminders.some(r => r.text.toLowerCase() === t.toLowerCase())
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-sky-900">Add to your daily brief?</h3>
      {offers.map(o => {
        const st = state[o.text]
        const added = has(o.text) || st?.state === 'completed'
        return (
          <div key={o.text} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-700">{o.text} <span className="text-gray-400">· {everyLabel(o.every_days)}</span></span>
            {added
              ? <span className="text-xs font-medium text-sky-700">In your brief ✓</span>
              : <button disabled={st?.state === 'waiting'} onClick={() => add(o.text, o.every_days, trialName, r => setState(p => ({ ...p, [o.text]: r })))}
                  className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40">
                  {st?.state === 'waiting' ? 'Adding…' : 'Add reminder'}
                </button>}
            {st?.state === 'failed' && <span className="w-full text-xs text-red-600">{st.message}</span>}
          </div>
        )
      })}
    </div>
  )
}

function KeyNumbers({ facts, unit }: { facts: ReviewFacts | null; unit: TempUnit }) {
  if (!facts) return null
  const cost = facts.energy?.electricity_cost_per_marketable_gram_usd
  const ph = facts.nutrients?.ph
  const day = facts.climate?.day_vs_night?.lights_on?.airtemp_C?.mean
  const night = facts.climate?.day_vs_night?.lights_off?.airtemp_C?.mean
  const tiles = [
    unit === 'F'
      ? { label: 'Marketable / plant', value: fmt(g(facts.yield?.marketable_g_per_plant), 1, ' oz') }
      : { label: 'Marketable / plant', value: fmt(facts.yield?.marketable_g_per_plant, 1, ' g') },
    unit === 'F'
      ? { label: 'Electricity / marketable oz', value: cost != null ? `$${(cost * G_PER_OZ).toFixed(2)}` : '—' }
      : { label: 'Electricity / marketable g', value: cost != null ? `$${cost.toFixed(3)}` : '—' },
    { label: ph?.band ? `pH ${ph.band[0]}–${ph.band[1]}` : 'pH in range', value: fmt(ph?.pct_time_in_band, 0, '% of the time') },
    { label: 'Day / night temp', value: day != null && night != null ? `${formatTemp(day, unit)} / ${formatTemp(night, unit)}` : '—' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {tiles.map(t => (
        <div key={t.label} className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-[11px] text-gray-400">{t.label}</p>
          <p className="text-sm font-semibold text-gray-700">{t.value}</p>
        </div>
      ))}
    </div>
  )
}

const G_PER_OZ = 28.3495
function g(v: number | null | undefined): number | null {
  return v == null ? null : v / G_PER_OZ
}

function fmt(v: number | null | undefined, digits: number, unit: string): string {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}${unit}`
}
