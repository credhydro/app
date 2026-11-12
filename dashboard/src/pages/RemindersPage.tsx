import { useState } from 'react'
import type { CommandOutcome } from '../hooks/useDeviceConfig'
import { EVERY_OPTIONS, everyLabel, useReminders } from '../hooks/useReminders'

/** Reminders that show up in the morning daily brief. */
export function RemindersPage() {
  const { reminders, loaded, add, remove } = useReminders()
  const [text, setText] = useState('')
  const [every, setEvery] = useState(7)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const busy = outcome?.state === 'waiting'

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-700">Daily brief reminders</h1>
      <p className="text-sm text-gray-500 -mt-3">Routine checks that show up in the morning brief when they're due.</p>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
        {!loaded && <p className="text-sm text-gray-400">Loading…</p>}
        {loaded && reminders.length === 0 && <p className="text-sm text-gray-500">No reminders yet.</p>}
        {reminders.map(r => (
          <div key={r.uuid} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700">{r.text}</p>
              <p className="text-xs text-gray-400">
                {everyLabel(r.every_days)}
                {r.source_trial ? ` · suggested by the ${r.source_trial} review` : ''}
                {r.last_shown_date ? ` · last in the brief ${new Date(`${r.last_shown_date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ' · first shows tomorrow morning'}
              </p>
            </div>
            <button disabled={removing === r.uuid} onClick={() => { setRemoving(r.uuid); remove(r.uuid, o => { if (o.state !== 'waiting') setRemoving(null) }) }}
              className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              {removing === r.uuid ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Add a reminder</h2>
        <input value={text} maxLength={120} onChange={e => setText(e.target.value)} placeholder="e.g. Top up the main reservoir"
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700" />
        <div className="flex flex-wrap items-center gap-2">
          <select value={every} onChange={e => setEvery(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700" aria-label="How often">
            {EVERY_OPTIONS.map(d => <option key={d} value={d}>{everyLabel(d)}</option>)}
          </select>
          <button disabled={!text.trim() || busy} onClick={() => add(text.trim(), every, null, o => { setOutcome(o); if (o.state === 'completed') setText('') })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
            {busy ? 'Adding… (up to a minute)' : 'Add'}
          </button>
        </div>
        {outcome?.state === 'failed' && <p className="text-sm text-red-600">{outcome.message}</p>}
      </section>
    </div>
  )
}
