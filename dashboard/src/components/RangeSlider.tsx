import type { ChangeEvent } from 'react'

interface RangeSliderProps {
  min: number
  max: number
  step: number
  low: number
  high: number
  onChange: (low: number, high: number) => void
  formatLabel?: (v: number) => string
}

const THUMB_CLASS =
  'absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-5 m-0 appearance-none bg-transparent pointer-events-none outline-none ' +
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto ' +
  '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white ' +
  '[&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-2 ' +
  '[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer'

export function RangeSlider({ min, max, step, low, high, onChange, formatLabel }: RangeSliderProps) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const label = formatLabel ?? ((v: number) => v.toFixed(1))

  function snap(v: number) {
    return Math.round(Math.round(v / step) * step * 100) / 100
  }

  function handleLowChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(Math.min(snap(Number(e.target.value)), high), high)
  }

  function handleHighChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(low, Math.max(snap(Number(e.target.value)), low))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
        <span>{label(low)}</span>
        <span>{label(high)}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-200" />
        <div
          className="absolute h-1.5 rounded-full bg-emerald-400"
          style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={handleLowChange}
          className={THUMB_CLASS}
          style={{ zIndex: low > (min + max) / 2 ? 5 : 3 }}
          aria-label="Minimum pH"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={handleHighChange}
          className={THUMB_CLASS}
          style={{ zIndex: 4 }}
          aria-label="Maximum pH"
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label(min)}</span>
        <span>{label(max)}</span>
      </div>
    </div>
  )
}
