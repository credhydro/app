import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AmbientData } from '../types'

const REFRESH_MS = 5 * 60 * 1000

export function useAmbientData(): AmbientData {
  const [state, setState] = useState<AmbientData>({
    latest: null,
    dli: null,
    assimilation: null,
    totalCost: null,
    loading: true,
    error: null,
  })

  async function fetch() {
    try {
      const [latestRes, dliRes, assimRes, costRes] = await Promise.all([
        supabase
          .from('ambient_raw')
          .select('ph, ec_us, vpd_kpa, datetime_utc')
          .order('datetime_utc', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('ambient_raw')
          .select('ppfd_umol_m2_s')
          .gte('datetime_utc', todayUtcStart()),

        supabase
          .from('ambient_derived')
          .select('assimilation_umol_m2_s')
          .order('datetime_utc', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('energy_costs')
          .select('energy_cost'),
      ])

      if (latestRes.error) throw latestRes.error
      if (dliRes.error) throw dliRes.error
      if (assimRes.error) throw assimRes.error
      if (costRes.error) throw costRes.error

      const rows = dliRes.data ?? []
      const dli =
        rows.length > 0
          ? rows.reduce((sum, r) => sum + (r.ppfd_umol_m2_s ?? 0) * 1800, 0) /
            1_000_000
          : null

      const assimilation = assimRes.data?.assimilation_umol_m2_s ?? null

      const costRows = costRes.data ?? []
      const totalCost =
        costRows.length > 0
          ? costRows.reduce((sum, r) => sum + (r.energy_cost ?? 0), 0)
          : null

      setState({ latest: latestRes.data, dli, assimilation, totalCost, loading: false, error: null })
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ?? JSON.stringify(e)
      setState((prev) => ({ ...prev, loading: false, error: msg }))
    }
  }

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  return state
}

function todayUtcStart(): string {
  const d = new Date()
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  ).toISOString()
}
