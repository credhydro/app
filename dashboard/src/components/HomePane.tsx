import { useAmbientData } from '../hooks/useAmbientData'
import { GaugeCard } from './GaugeCard'
import { TimelineChart } from './TimelineChart'

export function HomePane() {
  const { latest, dli, assimilation, totalCost, loading, error } = useAmbientData()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-300 text-sm">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        {error}
      </div>
    )
  }

  const lastUpdated = latest?.datetime_utc
    ? new Date(latest.datetime_utc).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6">
      <div className="flex items-baseline gap-4">
        <h1 className="text-xl font-semibold text-gray-700">Home</h1>
        {lastUpdated && (
          <span className="text-xs text-gray-400">Last reading: {lastUpdated}</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <GaugeCard
          label="pH"
          value={latest?.ph ?? null}
          unit="pH"
          min={0}
          max={14}
          goodMin={5.5}
          goodMax={6.5}
          decimals={2}
        />
        <GaugeCard
          label="EC"
          value={latest?.ec_us != null ? latest.ec_us / 1000 : null}
          unit="mS/cm"
          min={0}
          max={4}
          goodMin={1.0}
          goodMax={2.5}
          decimals={2}
        />
        <GaugeCard
          label="VPD"
          value={latest?.vpd_kpa ?? null}
          unit="kPa"
          min={0}
          max={3}
          goodMin={0.8}
          goodMax={1.2}
          decimals={2}
        />
        <GaugeCard
          label="DLI"
          value={dli}
          unit="mol/m²/day"
          min={0}
          max={50}
          goodMin={10}
          goodMax={30}
          decimals={1}
        />
        <GaugeCard
          label="Growth Rate"
          value={assimilation}
          unit="μmol/m²/s"
          min={-5}
          max={30}
          goodMin={10}
          goodMax={25}
          decimals={1}
        />

        {/* Running cost stat card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center p-5 gap-2">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Running Cost</span>
          <span className="text-4xl font-bold text-gray-700">
            {totalCost != null ? `$${totalCost.toFixed(2)}` : '—'}
          </span>
          <span className="text-sm text-gray-400">total</span>
        </div>
      </div>

      <TimelineChart />
    </div>
  )
}
