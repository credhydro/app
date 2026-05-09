interface Props {
  label: string
  value: number | null
  unit: string
  min: number
  max: number
  goodMin: number
  goodMax: number
  decimals?: number
}

const W = 220
const H = 130
const CX = W / 2
const CY = H - 10
const R = 95

function polarToXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  }
}

function arcPath(startDeg: number, endDeg: number, r: number) {
  const s = polarToXY(startDeg, r)
  const e = polarToXY(endDeg, r)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

// Map a value in [min,max] to an angle in [180°, 360°]
function valueToAngle(v: number, min: number, max: number) {
  return 180 + ((v - min) / (max - min)) * 180
}

export function GaugeCard({ label, value, unit, min, max, goodMin, goodMax, decimals = 1 }: Props) {
  const trackStart = 180
  const trackEnd = 360

  // Zone breakpoints as angles
  const aGoodMin = valueToAngle(Math.max(goodMin, min), min, max)
  const aGoodMax = valueToAngle(Math.min(goodMax, max), min, max)

  const clamped = value != null ? Math.min(Math.max(value, min), max) : null
  const needleAngle = clamped != null ? valueToAngle(clamped, min, max) : null
  const tip = needleAngle != null ? polarToXY(needleAngle, R - 12) : null
  const base1 = needleAngle != null ? polarToXY(needleAngle + 90, 6) : null
  const base2 = needleAngle != null ? polarToXY(needleAngle - 90, 6) : null

  const isGood = value != null && value >= goodMin && value <= goodMax

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center p-5 gap-2">
      <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">{label}</span>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Background track */}
        <path
          d={arcPath(trackStart, trackEnd, R)}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Low zone (below good) */}
        {aGoodMin > trackStart && (
          <path
            d={arcPath(trackStart, aGoodMin, R)}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={14}
            strokeLinecap="butt"
          />
        )}
        {/* Good zone */}
        <path
          d={arcPath(aGoodMin, aGoodMax, R)}
          fill="none"
          stroke="#34d399"
          strokeWidth={14}
          strokeLinecap="butt"
        />
        {/* High zone (above good) */}
        {aGoodMax < trackEnd && (
          <path
            d={arcPath(aGoodMax, trackEnd, R)}
            fill="none"
            stroke="#f87171"
            strokeWidth={14}
            strokeLinecap="butt"
          />
        )}

        {/* Needle */}
        {tip && base1 && base2 && (
          <polygon
            points={`${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`}
            fill={isGood ? '#059669' : '#6b7280'}
          />
        )}
        {/* Pivot */}
        <circle cx={CX} cy={CY} r={5} fill="#374151" />
      </svg>

      <div className="flex flex-col items-center -mt-2">
        {value != null ? (
          <>
            <span className={`text-4xl font-bold tabular-nums ${isGood ? 'text-emerald-600' : 'text-gray-700'}`}>
              {value.toFixed(decimals)}
            </span>
            <span className="text-sm text-gray-400 mt-0.5">{unit}</span>
          </>
        ) : (
          <span className="text-2xl text-gray-300">—</span>
        )}
      </div>

      <div className="flex justify-between w-full text-xs text-gray-300 px-2">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

