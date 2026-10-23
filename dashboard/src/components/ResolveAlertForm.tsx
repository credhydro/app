import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { CAUSES, MAX_CAUSES, type AlertRow } from '../hooks/useAlerts'
import { sendSettingsCommand, type CommandOutcome } from '../hooks/useDeviceConfig'

const MAX_NOTE = 500
const MAX_ACTION = 300

/**
 * "What was it?" -- the grower records what actually caused an alert. Saved on
 * the unit (the daily brief reads these back to suggest causes next time).
 */
export function ResolveAlertForm({ alert, onDone, onCancel }: {
  alert: AlertRow
  onDone: () => void
  onCancel: () => void
}) {
  const { selectedDevice, selectedTrial } = useAuth()
  const existing = alert.resolution
  const [causes, setCauses] = useState<string[]>(existing?.causes ?? [])
  const [note, setNote] = useState(existing?.note ?? '')
  const [action, setAction] = useState(existing?.action_taken ?? '')
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)

  const saving = outcome?.state === 'waiting'
  const atMax = causes.length >= MAX_CAUSES

  function toggle(key: string) {
    setCauses(c => (c.includes(key) ? c.filter(k => k !== key) : atMax ? c : [...c, key]))
  }

  async function save() {
    if (!selectedDevice || causes.length === 0) return
    await sendSettingsCommand(
      selectedDevice,
      'resolve_alert',
      { alert_uuid: alert.uuid, causes, note: note.trim() || null, action: action.trim() || null },
      selectedTrial ?? null,
      o => {
        setOutcome(o)
        if (o.state === 'completed') onDone()
      },
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-gray-600">What caused it? <span className="font-normal text-gray-400">(pick up to {MAX_CAUSES})</span></span>
        <div className="flex flex-wrap gap-1.5">
          {CAUSES.map(c => {
            const on = causes.includes(c.key)
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                disabled={saving || (!on && atMax)}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 text-xs disabled:opacity-40 ${
                  on ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">What you found <span className="font-normal text-gray-400">(optional)</span></span>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, MAX_NOTE))}
          rows={2}
          disabled={saving}
          placeholder="e.g. pH-down bottle was empty"
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">What you did <span className="font-normal text-gray-400">(optional)</span></span>
        <input
          value={action}
          onChange={e => setAction(e.target.value.slice(0, MAX_ACTION))}
          disabled={saving}
          placeholder="e.g. refilled it"
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || causes.length === 0}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40">
          Cancel
        </button>
        {outcome?.state === 'failed' && <span className="text-xs text-red-600">{outcome.message}</span>}
      </div>
      <p className="text-xs text-gray-400">
        Saved on your Argonaut. The daily brief uses these to suggest what to check if it happens again.
      </p>
    </div>
  )
}
