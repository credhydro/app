import type { CommandOutcome } from '../hooks/useDeviceConfig'

// Small form building blocks shared by the Settings and Lights pages.

export const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500'

export function diff<T extends Record<string, unknown>>(a: T, b: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(b) as (keyof T)[]) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = b[k]
  }
  return out
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function NumberInput({ value, step, onChange }: { value: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={Number.isFinite(value) ? value : ''}
      onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      className={inputCls}
    />
  )
}

export function SaveRow({
  disabled,
  outcome,
  onSave,
}: {
  disabled: boolean
  outcome: CommandOutcome | null
  onSave: () => void
}) {
  const waiting = outcome?.state === 'waiting'
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onSave}
        disabled={disabled}
        className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40"
      >
        {waiting ? 'Sending to Argonaut…' : 'Save'}
      </button>
      {waiting && (
        <p className="text-xs text-amber-600">Waiting for Argonaut to apply this. Usually under a minute.</p>
      )}
      {outcome?.state === 'completed' && <p className="text-xs text-emerald-600">Saved on Argonaut ✓</p>}
      {outcome?.state === 'failed' && <p className="text-xs text-red-500">{outcome.message}</p>}
    </div>
  )
}
