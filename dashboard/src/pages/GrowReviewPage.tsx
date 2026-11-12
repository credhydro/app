import { useSearchParams } from 'react-router-dom'
import { TrialFeedbackCard } from '../components/TrialFeedbackCard'
import { useReviewedGrows } from '../hooks/useTrialFeedback'

/** Argonaut's review of a finished grow: /grow-review?trial=trial_003 (default: the latest). */
export function GrowReviewPage() {
  const [params, setParams] = useSearchParams()
  const { names, loaded } = useReviewedGrows()
  const trial = params.get('trial') || names[0] || null
  const options = trial && !names.includes(trial) ? [trial, ...names] : names

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-700">Grow review</h1>
        {options.length > 1 && (
          <select value={trial ?? ''} onChange={e => setParams({ trial: e.target.value })}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600" aria-label="Grow">
            {options.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
      {trial
        ? <TrialFeedbackCard trialName={trial} />
        : <p className="text-sm text-gray-500">{loaded ? 'No grow has a review yet — one is written after each harvest is registered.' : 'Loading…'}</p>}
    </div>
  )
}
