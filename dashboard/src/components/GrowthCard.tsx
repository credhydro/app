import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrowthSeries, type GrowthInterval, type GrowthPoint } from '../hooks/useGrowthSeries'

// Hand-drawn SVG like the other dashboard charts. One series (average plant),
// a band from the smallest to the largest plant, a marker per photo session.
// Drawn at the container's real pixel width so text stays 12 px on any screen.
const VB_H = 220
const PAD_L = 40
const PAD_R = 12
const PAD_T = 12
const PAD_B = 26
const PLOT_H = VB_H - PAD_T - PAD_B
const LINE = '#059669'          // emerald-600 -- the app's accent
const BAND = '#10b981'          // emerald-500 at low opacity
const PHOTO_DUE_DAYS = 3        // two photos a week: due 3 days after the last one
const PHOTO_EVERY_DAYS = 3.5    // ... aiming for every 3-4 days

function fmtDay(t: number): string {
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function niceMax(v: number): number {
  const step = v <= 100 ? 20 : v <= 300 ? 50 : v <= 800 ? 100 : 200
  return Math.ceil((v * 1.08) / step) * step
}

export function GrowthCard() {
  const { points, intervals, transplant, transplantIssue, loading, error } = useGrowthSeries()
  const photos = points.filter(p => !p.anchor)
  const daysSince = photos.length ? (Date.now() - photos[photos.length - 1].t) / 86400000 : null
  const photoDue = daysSince === null || daysSince >= PHOTO_DUE_DAYS
  const nextBy = photos.length ? new Date(photos[photos.length - 1].t + PHOTO_EVERY_DAYS * 86400000) : null

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Plant growth</h2>
        {!loading && <PhotoStatus daysSince={daysSince} due={photoDue} nextBy={nextBy} />}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-gray-500">
          No growth photos yet for this grow. <Link to="/growth-photos" className="text-emerald-700 hover:underline">Take the first one →</Link>
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr,180px]">
          <div className="flex flex-col gap-1.5 min-w-0">
            <Chart points={points} transplant={transplant} />
            <p className="text-xs text-gray-400">
              Line: average plant, canopy area seen from above (cm²). Shaded: smallest to largest plant.
              {points[0]?.anchor && ' Hollow point: transplant day, taken as zero.'}
              {transplantIssue !== null && ` The trial's planting date (${fmtDay(transplantIssue)}) doesn't match these photos, so the chart starts at the first photo.`}
            </p>
          </div>
          <RateTile intervals={intervals} points={photos} />
        </div>
      )}

    </section>
  )
}

/** Always-visible photo cadence: when the next photo is due, or that it is due now. */
function PhotoStatus({ daysSince, due, nextBy }: { daysSince: number | null; due: boolean; nextBy: Date | null }) {
  const ago = daysSince === null ? null
    : daysSince < 1 ? 'today' : `${Math.round(daysSince)} day${Math.round(daysSince) === 1 ? '' : 's'} ago`
  if (due) {
    return (
      <Link to="/growth-photos"
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100">
        <span aria-hidden>●</span> Photo due{ago && ` · last ${ago}`} — take one →
      </Link>
    )
  }
  return (
    <span className="text-xs text-gray-400">
      Last photo {ago}{nextBy && ` · next by ${nextBy.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`}
    </span>
  )
}

function RateTile({ intervals, points }: { intervals: GrowthInterval[]; points: GrowthPoint[] }) {
  const last = intervals[intervals.length - 1]
  const prev = intervals[intervals.length - 2]
  if (!last) {
    return (
      <div className="flex flex-col justify-center gap-1 rounded-xl bg-gray-50 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Growth rate</span>
        <span className="text-sm text-gray-600">
          {points.length === 1 ? 'Take another photo in a few days to see how fast your plants are growing.' : '—'}
        </span>
      </div>
    )
  }
  const diff = prev ? last.rgrPctPerDay - prev.rgrPctPerDay : null
  const trend = diff === null ? null : Math.abs(diff) < 0.3 ? 'steady' : diff > 0 ? 'faster' : 'slower'
  const arrow = trend === 'faster' ? '↑' : trend === 'slower' ? '↓' : trend === 'steady' ? '→' : ''
  return (
    <div className="flex flex-col justify-center gap-1 rounded-xl bg-gray-50 p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Growth rate</span>
      <span className="text-3xl font-semibold text-gray-700">
        {last.rgrPctPerDay >= 0 ? '' : '−'}{Math.abs(last.rgrPctPerDay).toFixed(1)}%
        <span className="text-sm font-normal text-gray-400"> /day</span>
      </span>
      <span className="text-xs text-gray-500">{fmtDay(last.from)} – {fmtDay(last.to)}</span>
      {trend && prev && (
        <span className="text-sm text-gray-700">
          {arrow} {trend === 'steady' ? 'About the same as' : trend === 'faster' ? 'Faster than' : 'Slower than'} the
          period before ({prev.rgrPctPerDay.toFixed(1)}%/day)
        </span>
      )}
    </div>
  )
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(e => setW(Math.max(240, Math.round(e[0].contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function Chart({ points, transplant }: { points: GrowthPoint[]; transplant: number | null }) {
  const [hover, setHover] = useState<number | null>(null)
  const [wrapRef, VB_W] = useWidth<HTMLDivElement>()
  const PLOT_W = VB_W - PAD_L - PAD_R
  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  const span = Math.max(t1 - t0, 86400000)                    // at least a day, so one point sits mid-chart
  const yMax = niceMax(Math.max(...points.map(p => p.max)))
  const x = (t: number) => PAD_L + (points.length === 1 ? PLOT_W / 2 : ((t - t0) / span) * PLOT_W)
  const y = (v: number) => PAD_T + PLOT_H - (v / yMax) * PLOT_H

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * yMax))
  const band =
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.max).toFixed(1)}`).join(' ') +
    ' ' +
    [...points].reverse().map(p => `L${x(p.t).toFixed(1)},${y(p.min).toFixed(1)}`).join(' ') + ' Z'
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.mean).toFixed(1)}`).join(' ')

  // x labels: every photo session, thinned so they never collide (~70 px apart)
  const labelIdx: number[] = []
  let lastX = -Infinity
  points.forEach((p, i) => {
    if (x(p.t) - lastX >= 70) {
      labelIdx.push(i)
      lastX = x(p.t)
    }
  })
  const lastI = points.length - 1                              // always label the latest photo
  if (labelIdx[labelIdx.length - 1] !== lastI) {
    if (x(points[lastI].t) - x(points[labelIdx[labelIdx.length - 1]].t) < 70) labelIdx.pop()
    labelIdx.push(lastI)
  }

  const h = hover !== null ? points[hover] : null
  return (
    <div className="relative" ref={wrapRef}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width={VB_W} height={VB_H} className="block max-w-full" role="img"
        aria-label={`Average canopy area grew from ${points[0].mean.toFixed(0)} to ${points[points.length - 1].mean.toFixed(0)} cm² over ${points.length} photo sessions`}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD_L} x2={VB_W - PAD_R} y1={y(v)} y2={y(v)} stroke="#f3f4f6" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="#9ca3af">{v}</text>
          </g>
        ))}
        {points.length > 1 && <path d={band} fill={BAND} fillOpacity={0.14} />}
        {points.length > 1 && <path d={line} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />}
        {h && <line x1={x(h.t)} x2={x(h.t)} y1={PAD_T} y2={PAD_T + PLOT_H} stroke="#d1d5db" strokeWidth={1} />}
        {points.map((p, i) => p.anchor ? (
          <circle key={p.t} cx={x(p.t)} cy={y(p.mean)} r={hover === i ? 6 : 4.5} fill="#fff" stroke={LINE} strokeWidth={2} />
        ) : (
          <circle key={p.t} cx={x(p.t)} cy={y(p.mean)} r={hover === i ? 6 : 4.5} fill={LINE} stroke="#fff" strokeWidth={2} />
        ))}
        {labelIdx.map(i => {
          const px = x(points[i].t)
          const anchor = px - PAD_L < 24 ? 'start' : VB_W - PAD_R - px < 24 ? 'end' : 'middle'
          return <text key={i} x={px} y={VB_H - 8} textAnchor={anchor} fontSize={12} fill="#9ca3af">{fmtDay(points[i].t)}</text>
        })}
        {/* hit targets: a full-height column around each point, wider than the marker */}
        {points.map((p, i) => {
          const left = i === 0 ? PAD_L : (x(points[i - 1].t) + x(p.t)) / 2
          const right = i === points.length - 1 ? VB_W - PAD_R : (x(p.t) + x(points[i + 1].t)) / 2
          return (
            <rect key={`hit-${p.t}`} x={left} y={PAD_T} width={Math.max(1, right - left)} height={PLOT_H} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)} />
          )
        })}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm whitespace-nowrap"
          style={x(h.t) < VB_W / 2
            ? { left: x(h.t) + 12, top: Math.max(0, y(h.mean) - 70) }
            : { right: VB_W - x(h.t) + 12, top: Math.max(0, y(h.mean) - 70) }}
        >
          {h.anchor ? (
            <>
              <div className="font-medium text-gray-700">{fmtDay(h.t)} · transplanted</div>
              <div className="text-gray-500">Growth taken to start at 0</div>
            </>
          ) : (
            <>
              <div className="font-medium text-gray-700">
                {fmtDay(h.t)}
                {transplant !== null && h.t > transplant && <span className="font-normal text-gray-400"> · day {Math.floor((h.t - transplant) / 86400000)}</span>}
              </div>
              <div className="text-gray-600">Average {h.mean.toFixed(0)} cm²</div>
              <div className="text-gray-500">Range {h.min.toFixed(0)}–{h.max.toFixed(0)} cm² · {h.n} plants</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
