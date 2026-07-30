import { useOperationsData } from '../hooks/useOperationsData'
import type { OnPeriod } from '../hooks/useOperationsData'

const VB_W    = 800
const LABEL_W = 58
const PAD_R   = 8
const PAD_T   = 10
const CHART_W = VB_W - LABEL_W - PAD_R
const ROW_H   = 22
const ROW_GAP = 10
const AXIS_H  = 32

const ROWS = [
  { key: 'lights' as const, label: 'Lights', color: '#fbbf24' },
  { key: 'fan'    as const, label: 'Fan',    color: '#60a5fa' },
  { key: 'pumps'  as const, label: 'Pump',   color: '#34d399' },
  { key: 'dosing' as const, label: 'Dosing', color: '#f87171' },
]

const VB_H = PAD_T + ROWS.length * (ROW_H + ROW_GAP) - ROW_GAP + AXIS_H + 4

function rowY(i: number) { return PAD_T + i * (ROW_H + ROW_GAP) }
const AXIS_Y = PAD_T + ROWS.length * (ROW_H + ROW_GAP)

export function TimelineChart() {
  const { lights, fan, pumps, dosing, loading, error } = useOperationsData()

  const now   = new Date()
  const start = new Date(now.getTime() - 48 * 3600 * 1000)

  function tX(t: Date): number {
    const frac = (t.getTime() - start.getTime()) / (now.getTime() - start.getTime())
    return LABEL_W + Math.max(0, Math.min(1, frac)) * CHART_W
  }

  function periodRect(p: OnPeriod, y: number, color: string, key: string) {
    const x1 = tX(p.start)
    const x2 = tX(p.end)
    const w  = Math.max(3, x2 - x1)
    return <rect key={key} x={x1} y={y} width={w} height={ROW_H} fill={color} rx={3} opacity={0.85} />
  }

  const ticks = [-48, -36, -24, -12, 0].map(h => {
    const t = new Date(now.getTime() + h * 3600 * 1000)
    const label = h === 0
      ? 'Now'
      : t.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', hour12: true })
    return { x: tX(t), label }
  })

  const data = { lights, fan, pumps, dosing }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
        Operations — last 48 h
      </h2>

      {loading && (
        <div className="text-xs text-gray-300 py-6 text-center">Loading…</div>
      )}
      {error && (
        <div className="text-xs text-red-400 py-6 text-center">{error}</div>
      )}
      {!loading && !error && (
        <svg
          width="100%"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="overflow-visible"
        >
          {ROWS.map((row, i) => {
            const y = rowY(i)
            return (
              <g key={row.key}>
                <rect x={LABEL_W} y={y} width={CHART_W} height={ROW_H} fill="#f9fafb" rx={3} />
                <text x={LABEL_W - 6} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
                  {row.label}
                </text>
                {row.key === 'dosing'
                  ? (data.dosing as Date[]).map((t, j) => (
                      <rect
                        key={j}
                        x={tX(t) - 2}
                        y={y}
                        width={4}
                        height={ROW_H}
                        fill={row.color}
                        rx={2}
                        opacity={0.9}
                      />
                    ))
                  : (data[row.key] as OnPeriod[]).map((p, j) =>
                      periodRect(p, y, row.color, `${row.key}-${j}`)
                    )}
              </g>
            )
          })}

          <line x1={LABEL_W} y1={AXIS_Y} x2={LABEL_W + CHART_W} y2={AXIS_Y} stroke="#e5e7eb" strokeWidth={1} />
          {ticks.map(({ x, label }) => (
            <g key={label}>
              <line x1={x} y1={AXIS_Y} x2={x} y2={AXIS_Y + 4} stroke="#d1d5db" strokeWidth={1} />
              <text x={x} y={AXIS_Y + 16} textAnchor="middle" fontSize={10} fill="#9ca3af">{label}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}