import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/** One sensor's "working" verdict -- from the logged readings alone. */
export interface WorkingStatus {
  label: string
  status: 'ok' | 'watch' | 'problem'
  reasons: string[]
  action: string | null
  latest: number | null
}

/** One probe's "accurate" verdict -- from calibrations and reference checks only. */
export interface AccuracyStatus {
  state: 'good' | 'check_due' | 'drifted' | 'swap_due' | 'unknown'
  action: string | null
  unit: string
  tolerance: number
  probe_name: string | null
  calibrated_utc: string | null
  days_since_calibration: number | null
  last_check: { datetime_utc: string; reference: string; reading: number; error: number; applied_offset: number | null } | null
  days_since_verified: number | null
  offset_applied: number | null
  drift_per_30_days: number | null
  estimated_error_now: number | null
  next_check_by: string | null
  next_check_reason: 'interval' | 'drift' | 'swap' | null
  swap_by: string | null
  checks_since_calibration: number
}

export interface SensorStatus {
  generated_utc: string
  working: Record<string, WorkingStatus>
  accurate: { ph: AccuracyStatus; ec: AccuracyStatus }
  probe_out_until?: { ph: string | null; ec: string | null }
}

export interface SensorCheck {
  uuid: string
  datetime_utc: string
  sensor: 'ph' | 'ec'
  probe_name: string | null
  reference: string
  reference_value: number | null
  reading: number | null
  error: number | null
  error_unit: string | null
  stable: boolean | null
  applied_offset: number | null
}

export function useSensorStatus() {
  const { selectedDevice } = useAuth()
  const [status, setStatus] = useState<SensorStatus | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [checks, setChecks] = useState<SensorCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!selectedDevice) return
    let cancelled = false
    async function load() {
      const since = new Date(Date.now() - 365 * 86400000).toISOString()
      const [s, c] = await Promise.all([
        supabase.from('sensor_status').select('status, updated_at').eq('device_id', selectedDevice).maybeSingle(),
        supabase
          .from('sensor_checks')
          .select('uuid, datetime_utc, sensor, probe_name, reference, reference_value, reading, error, error_unit, stable, applied_offset')
          .eq('device_id', selectedDevice)
          .gte('datetime_utc', since)
          .order('datetime_utc', { ascending: false })
          .limit(100),
      ])
      if (cancelled) return
      if (s.error) setError(s.error.message)
      else {
        setError(null)
        setStatus((s.data?.status as SensorStatus | undefined) ?? null)
        setUpdatedAt(s.data?.updated_at ?? null)
      }
      if (!c.error) setChecks((c.data ?? []) as SensorCheck[])
      setLoading(false)
    }
    load()
    const id = setInterval(load, 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedDevice, tick])

  return { status, updatedAt, checks, loading, error, refresh }
}
