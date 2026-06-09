import { useAuth } from '../context/AuthContext'
import { useTrials } from '../hooks/useTrials'

export function TrialPicker() {
  const { selectedTrial, setSelectedTrial } = useAuth()
  const trials = useTrials()

  if (trials.length === 0) return null

  return (
    <div className="px-3 py-2">
      <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
        Trial
      </label>
      <select
        value={selectedTrial ?? ''}
        onChange={e => setSelectedTrial(e.target.value || null)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        <option value="">All trials</option>
        {trials.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </div>
  )
}
