import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { monthRange } from './useMonths'
import type { AmbientData } from '../types'

const REFRESH_MS = 5 * 60 * 1000

export function useAmbientData(): AmbientData {
  const { selectedDevice, selectedTrial, selectedMonth } = useAuth()
  const [state, setState] = useState<AmbientData>({
    latest: null,
    dli: null,
    assimilation: null,
    totalCost: null,
    loading: true,
    error: null,
  })

  async function fetch() {
    if (!selectedDevice) return

    try {
      // Step 1: get latest row to determine the active trial when none is manually selected
      const latestRes = await supabase
        .from('ambient_raw')
        .select('ph, ec_us, vpd_kpa, datetime_utc, trial_name')
        .eq('device_id', selectedDevice)
        .order('datetime_utc', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestRes.error) throw latestRes.error

      const activeTrial = selectedTrial ?? latestRes.data?.trial_name ?? null

      const applyFilters = (q: any) => {
        if (selectedTrial) q = q.eq('trial_name', selectedTrial)
        if (selectedMonth) {
          const { gte, lt } = monthRange(selectedMonth)
          q = q.gte('datetime_utc', gte).lt('datetime_utc', lt)
        }
        return q
      }

      const [dliRes, assimRes, costRes] = await Promise.all([
        applyFilters(supabase
          .from('lights')
          .select('dli_mol_m2_day')
          .eq('device_id', selectedDevice))
          .order('datetime_utc', { ascending: false })
          .limit(1)
          .maybeSingle(),

        applyFilters(supabase
          .from('ambient_derived')
          .select('assimilation_umol_m2_s')
          .eq('device_id', selectedDevice))
          .order('datetime_utc', { ascending: false })
          .limit(1)
          .maybeSingle(),

        activeTrial
          ? applyFilters(supabase
              .from('energy_costs')
              .select('energy_cost')
              .eq('device_id', selectedDevice)
              .eq('trial_name', activeTrial))
          : applyFilters(supabase
              .from('energy_costs')
              .select('energy_cost')
              .eq('device_id', selectedDevice)),
      ])

      if (dliRes.error) throw dliRes.error
      if (assimRes.error) throw assimRes.error
      if (costRes.error) throw costRes.error

      const dli = dliRes.data?.dli_mol_m2_day ?? null

      const assimilation = assimRes.data?.assimilation_umol_m2_s ?? null

      const costRows: { energy_cost: number | null }[] = costRes.data ?? []
      const totalCost =
        costRows.length > 0
          ? costRows.reduce((sum: number, r) => sum + (r.energy_cost ?? 0), 0)
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
    setState(prev => ({ ...prev, loading: true }))
    fetch()
    const id = setInterval(fetch, REFRESH_MS)
    return () => clearInterval(id)
  }, [selectedDevice, selectedTrial, selectedMonth])

  return state
}
