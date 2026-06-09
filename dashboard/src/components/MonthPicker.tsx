import { useAuth } from '../context/AuthContext'
import { useMonths, formatMonth } from '../hooks/useMonths'

export function MonthPicker() {
  const { selectedMonth, setSelectedMonth } = useAuth()
  const months = useMonths()

  if (months.length === 0) return null

  return (
    <div className="px-3 py-2">
      <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
        Month
      </label>
      <select
        value={selectedMonth ?? ''}
        onChange={e => setSelectedMonth(e.target.value || null)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        <option value="">All months</option>
        {months.map(m => (
          <option key={m} value={m}>{formatMonth(m)}</option>
        ))}
      </select>
    </div>
  )
}
