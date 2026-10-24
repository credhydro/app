import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { PhotoResult } from '../types'

/** One photo session: all accepted photos taken within SAME_SESSION_HOURS, plants averaged. */
export interface GrowthPoint {
  t: number            // ms, capture time (first photo of the session)
  mean: number         // average canopy area across plants, cm2
  min: number          // smallest plant
  max: number          // largest plant
  n: number            // plants measured
  /** The transplant-day zero point (not a photo): growth assumed to start at 0. */
  anchor?: boolean
}

/** Relative growth rate of the AVERAGE plant between two sessions. */
export interface GrowthInterval {
  from: number
  to: number
  days: number
  rgrPctPerDay: number  // 100 * ln(mean2 / mean1) / days
}

const SAME_SESSION_HOURS = 12
const MIN_DAYS_FOR_RATE = 0.5
const MAX_ANCHOR_GAP_DAYS = 30

export function useGrowthSeries() {
  const { selectedDevice, selectedTrial } = useAuth()
  const [points, setPoints] = useState<GrowthPoint[]>([])
  const [transplant, setTransplant] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedDevice) return
    let cancelled = false
    async function load() {
      let q = supabase
        .from('photo_uploads')
        .select('result, created_at, trial_name')
        .eq('device_id', selectedDevice)
        .eq('status', 'done')
        .eq('qc_status', 'ok')
        .order('created_at', { ascending: true })
        .limit(200)
      if (selectedTrial) q = q.eq('trial_name', selectedTrial)
      const res = await q
      if (cancelled) return
      if (res.error) {
        setError(res.error.message)
        setLoading(false)
        return
      }
      setError(null)
      const rows = res.data ?? []
      setPoints(toSessions(rows.map(r => r.result as PhotoResult | null)))

      // Transplant day = the trial's planting_date: growth is taken to start at 0 there.
      const trial = selectedTrial ?? (rows.length ? rows[rows.length - 1].trial_name : null)
      let planted: number | null = null
      if (trial) {
        const t = await supabase
          .from('trials')
          .select('planting_date')
          .eq('trial_name', trial)
          .eq('device_id', selectedDevice)
          .maybeSingle()
        const d = t.data?.planting_date as string | undefined
        if (d) planted = new Date(`${d.slice(0, 10)}T00:00:00`).getTime()
      }
      if (cancelled) return
      setTransplant(Number.isFinite(planted) ? planted : null)
      setLoading(false)
    }
    load()
    const id = setInterval(load, 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedDevice, selectedTrial])

  // Draw the zero point only when it is plausible: before the first photo and not
  // more than MAX_ANCHOR_GAP_DAYS earlier (e.g. a trial name reused for a new crop
  // keeps the old planting date). Otherwise flag it instead of squashing the chart.
  const gapDays = transplant !== null && points.length ? (points[0].t - transplant) / 86400000 : null
  const anchorOk = gapDays !== null && gapDays > 0 && gapDays <= MAX_ANCHOR_GAP_DAYS
  const withAnchor: GrowthPoint[] = anchorOk
    ? [{ t: transplant as number, mean: 0, min: 0, max: 0, n: 0, anchor: true }, ...points]
    : points
  const transplantIssue = gapDays !== null && !anchorOk ? transplant : null
  // Rates are photo-to-photo only: a rate from zero is infinite.
  return { points: withAnchor, intervals: toIntervals(points), transplant: anchorOk ? transplant : null,
           transplantIssue, loading, error }
}

/** Group photos taken close together (a retake, two angles) and average each plant across them. */
function toSessions(results: (PhotoResult | null)[]): GrowthPoint[] {
  const shots = results
    .filter((r): r is PhotoResult => !!r && Array.isArray(r.plants) && !!r.captured_utc)
    .map(r => ({ t: new Date(r.captured_utc).getTime(), plants: r.plants }))
    .filter(s => Number.isFinite(s.t))
    .sort((a, b) => a.t - b.t)

  const sessions: { t: number; areas: Map<string, number[]> }[] = []
  for (const s of shots) {
    let cur = sessions[sessions.length - 1]
    if (!cur || s.t - cur.t > SAME_SESSION_HOURS * 3600 * 1000) {
      cur = { t: s.t, areas: new Map() }
      sessions.push(cur)
    }
    for (const p of s.plants) {
      if (p.canopy_area_cm2 == null || !(p.canopy_area_cm2 > 0)) continue
      const list = cur.areas.get(p.plant_id) ?? []
      list.push(p.canopy_area_cm2)
      cur.areas.set(p.plant_id, list)
    }
  }

  return sessions
    .map(s => {
      const perPlant = [...s.areas.values()].map(v => v.reduce((a, b) => a + b, 0) / v.length)
      if (perPlant.length === 0) return null
      return {
        t: s.t,
        mean: perPlant.reduce((a, b) => a + b, 0) / perPlant.length,
        min: Math.min(...perPlant),
        max: Math.max(...perPlant),
        n: perPlant.length,
      }
    })
    .filter((p): p is GrowthPoint => p !== null)
}

function toIntervals(points: GrowthPoint[]): GrowthInterval[] {
  const out: GrowthInterval[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const days = (b.t - a.t) / 86400000
    if (days < MIN_DAYS_FOR_RATE || a.mean <= 0 || b.mean <= 0) continue
    out.push({ from: a.t, to: b.t, days, rgrPctPerDay: (100 * Math.log(b.mean / a.mean)) / days })
  }
  return out
}
