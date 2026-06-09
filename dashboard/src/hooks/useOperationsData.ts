import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { monthRange } from './useMonths'

export interface OnPeriod { start: Date; end: Date }

export interface OperationsData {
  lights: OnPeriod[]
  fan: OnPeriod[]
  pumps: OnPeriod[]
  dosing: Date[]
  loading: boolean
  error: string | null
}

const REFRESH_MS = 5 * 60 * 1000
const INTERVAL_MS = 30 * 60 * 1000  // default 30-min slot for lights

export function useOperationsData(): OperationsData {
  const { selectedDevice, selectedTrial, selectedMonth } = useAuth()
  const [state, setState] = useState<OperationsData>({
    lights: [], fan: [], pumps: [], dosing: [], loading: true, error: null,
  })

  async function fetch() {
    if (!selectedDevice) return

    const applyFilters = (q: any) => {
      if (selectedTrial) q = q.eq('trial_name', selectedTrial)
      if (selectedMonth) {
        const { gte, lt } = monthRange(selectedMonth)
        q = q.gte('datetime_utc', gte).lt('datetime_utc', lt)
      } else {
        q = q.gte('datetime_utc', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
      }
      return q
    }
    try {
      const [lightsRes, fanRes, pumpsRes, dosingRes] = await Promise.all([
        applyFilters(supabase.from('lights').select('datetime_utc, energy_wh').eq('device_id', selectedDevice)).order('datetime_utc'),
        applyFilters(supabase.from('fan').select('datetime_utc, on_mins').eq('device_id', selectedDevice)).order('datetime_utc'),
        applyFilters(supabase.from('circulation').select('datetime_utc, pump_on_mins').eq('device_id', selectedDevice)).order('datetime_utc'),
        applyFilters(supabase.from('dosing_events').select('datetime_utc').eq('device_id', selectedDevice)).order('datetime_utc'),
      ])

      if (lightsRes.error) throw lightsRes.error
      if (fanRes.error) throw fanRes.error
      if (pumpsRes.error) throw pumpsRes.error
      if (dosingRes.error) throw dosingRes.error

      const lights: OnPeriod[] = ((lightsRes.data ?? []) as { datetime_utc: string; energy_wh: number | null }[])
        .filter(r => r.energy_wh)
        .map(r => {
          const start = new Date(r.datetime_utc)
          return { start, end: new Date(start.getTime() + INTERVAL_MS) }
        })

      const fan: OnPeriod[] = ((fanRes.data ?? []) as { datetime_utc: string; on_mins: number | null }[])
        .filter(r => r.on_mins)
        .map(r => {
          const start = new Date(r.datetime_utc)
          return { start, end: new Date(start.getTime() + (r.on_mins ?? 30) * 60 * 1000) }
        })

      const pumps: OnPeriod[] = ((pumpsRes.data ?? []) as { datetime_utc: string; pump_on_mins: number | null }[])
        .filter(r => r.pump_on_mins)
        .map(r => {
          const start = new Date(r.datetime_utc)
          return { start, end: new Date(start.getTime() + (r.pump_on_mins ?? 30) * 60 * 1000) }
        })

      const dosing: Date[] = ((dosingRes.data ?? []) as { datetime_utc: string }[]).map(r => new Date(r.datetime_utc))

      setState({ lights, fan, pumps, dosing, loading: false, error: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e)
      setState(prev => ({ ...prev, loading: false, error: msg }))
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
