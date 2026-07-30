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
const PAGE_SIZE = 1000               // matches Supabase's default max-rows cap

// Fetches every row matching a query, paging past Supabase's row cap.
// buildQuery must return a FRESH query object each call (Supabase queries
// can only be awaited once), with .range() applied by this function.
async function fetchAllRows<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await buildQuery(from, to)
    if (error) throw error
    const page = (data ?? []) as T[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break // last page reached
    from += PAGE_SIZE
  }
  return all
}

export function useOperationsData(): OperationsData {
  const { selectedDevice, selectedTrial, selectedMonth } = useAuth()
  const [state, setState] = useState<OperationsData>({
    lights: [], fan: [], pumps: [], dosing: [], loading: true, error: null,
  })

  async function fetch() {
    if (!selectedDevice) return

    // Applies device/trial/month filters. Returns a fresh query each call
    // since Supabase query builders are single-use once awaited.
    function applyFilters(table: string, columns: string) {
      return (from: number, to: number) => {
        let q = supabase.from(table).select(columns).eq('device_id', selectedDevice)
        if (selectedTrial) q = q.eq('trial_name', selectedTrial)
        if (selectedMonth) {
          const { gte, lt } = monthRange(selectedMonth)
          q = q.gte('datetime_utc', gte).lt('datetime_utc', lt)
        } else {
          q = q.gte('datetime_utc', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
        }
        return q.order('datetime_utc', { ascending: true }).range(from, to)
      }
    }

    try {
      const [lightsData, fanData, pumpsData, dosingData] = await Promise.all([
        fetchAllRows<{ datetime_utc: string; energy_wh: number | null }>(
          applyFilters('lights', 'datetime_utc, energy_wh')
        ),
        fetchAllRows<{ datetime_utc: string; on_mins: number | null }>(
          applyFilters('fan', 'datetime_utc, on_mins')
        ),
        fetchAllRows<{ datetime_utc: string; pump_on_mins: number | null }>(
          applyFilters('circulation', 'datetime_utc, pump_on_mins')
        ),
        fetchAllRows<{ datetime_utc: string }>(
          applyFilters('dosing_events', 'datetime_utc')
        ),
      ])

      const lights: OnPeriod[] = lightsData
        .filter(r => r.energy_wh)
        .map(r => {
          const start = new Date(r.datetime_utc)
          return { start, end: new Date(start.getTime() + INTERVAL_MS) }
        })
      const fan: OnPeriod[] = fanData
        .filter(r => r.on_mins)
        .map(r => {
          const start = new Date(r.datetime_utc)
          return { start, end: new Date(start.getTime() + (r.on_mins ?? 30) * 60 * 1000) }
        })
      const pumps: OnPeriod[] = pumpsData
        .filter(r => r.pump_on_mins)
        .map(r => {
          const start = new Date(r.datetime_utc)
          return { start, end: new Date(start.getTime() + (r.pump_on_mins ?? 30) * 60 * 1000) }
        })
      const dosing: Date[] = dosingData.map(r => new Date(r.datetime_utc))

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