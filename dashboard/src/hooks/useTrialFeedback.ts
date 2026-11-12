import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export type FeedbackTopic =
  | 'yield' | 'climate' | 'light_photosynthesis' | 'nutrients_dosing' | 'growth' | 'energy_cost' | 'sensors_data'

export interface TrialReview {
  headline: string
  overall: 'strong' | 'solid' | 'mixed' | 'poor'
  summary: string
  sections: { topic: FeedbackTopic; verdict: 'good' | 'ok' | 'watch' | 'problem'; text: string }[]
  try_next_time: { suggestion: string; why: string; expected_effect?: string; confidence: 'low' | 'medium' | 'high'
                   basis: 'this_grow' | 'past_grows' | 'general_horticulture' }[]
  caveats?: string[]
}

/** The numbers shown as tiles -- a small slice of what the review was written from. */
export interface ReviewFacts {
  yield?: { marketable_g_per_plant?: number | null; marketable_g?: number | null }
  grow?: { days_from_start?: number | null }
  energy?: { electricity_cost_per_marketable_gram_usd?: number | null; total_cost_usd?: number | null }
  nutrients?: { ph?: { pct_time_in_band?: number | null; band?: [number, number] } }
  light_and_photosynthesis?: { mean_dli_mol_m2_day?: number | null }
  climate?: { day_vs_night?: { lights_on?: { airtemp_C?: { mean?: number } }; lights_off?: { airtemp_C?: { mean?: number } } } }
}

export interface TrialFeedbackRow {
  trial_name: string
  status: 'pending' | 'done' | 'failed'
  error: string | null
  datetime_utc: string
  model: string | null
  feedback: TrialReview | null
  facts: ReviewFacts | null
}

/**
 * Argonaut's review of one grow (public.trial_feedback). Polls every 15 s while it is
 * being written: status pending, or -- when `waitSince` (ms) is set, e.g. just after a
 * harvest or "Write it again" -- until a row newer than that time arrives.
 */
export function useTrialFeedback(trialName: string | null | undefined, waitSince: number | null = null) {
  const { selectedDevice } = useAuth()
  const [row, setRow] = useState<TrialFeedbackRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!selectedDevice || !trialName) { setRow(null); setLoading(false); return }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function load() {
      const res = await supabase
        .from('trial_feedback')
        .select('trial_name, status, error, datetime_utc, model, feedback, facts')
        .eq('device_id', selectedDevice)
        .eq('trial_name', trialName)
        .maybeSingle()
      if (cancelled) return
      let next: TrialFeedbackRow | null = null
      if (res.error) setError(res.error.message)
      else {
        setError(null)
        next = (Array.isArray(res.data) ? res.data[0] : res.data) as TrialFeedbackRow | null
        setRow(next)
      }
      setLoading(false)
      // Keep checking only while the review is being written.
      const stale = waitSince != null && (!next || new Date(next.datetime_utc).getTime() < waitSince - 60000)
      if (next?.status === 'pending' || stale) timer = setTimeout(load, 15000)
    }
    load()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [selectedDevice, trialName, tick, waitSince])

  const writing = row?.status === 'pending' ||
    (waitSince != null && (!row || new Date(row.datetime_utc).getTime() < waitSince - 60000))
  return { row, loading, error, writing, refresh }
}

/** Grows on this unit that have a review, newest first. */
export function useReviewedGrows() {
  const { selectedDevice } = useAuth()
  const [names, setNames] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!selectedDevice) return
    let cancelled = false
    supabase.from('trial_feedback').select('trial_name, datetime_utc').eq('device_id', selectedDevice)
      .order('datetime_utc', { ascending: false }).limit(50)
      .then(res => {
        if (cancelled) return
        setNames(((res.data ?? []) as { trial_name: string }[]).map(r => r.trial_name))
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [selectedDevice])
  return { names, loaded }
}
