import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface LightsStatus {
  isOn: boolean | null
  lastReading: string | null
  pendingCommand: string | null
  schedule: number[]
  loading: boolean
  error: string | null
}

const LIGHTS_COMMANDS = ['lights_on', 'lights_off', 'lights_auto', 'set_lights_schedule']
const REFRESH_MS = 30 * 1000

export function useLightsStatus(): LightsStatus {
  const { selectedDevice } = useAuth()
  const [state, setState] = useState<LightsStatus>({
    isOn: null,
    lastReading: null,
    pendingCommand: null,
    schedule: [],
    loading: true,
    error: null,
  })

  async function fetch() {
    if (!selectedDevice) return
    try {
      const [latestRes, pendingRes, scheduleRes] = await Promise.all([
        supabase
          .from('lights')
          .select('energy_wh, datetime_utc')
          .eq('device_id', selectedDevice)
          .order('datetime_utc', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('commands')
          .select('command')
          .eq('device_id', selectedDevice)
          .eq('status', 'pending')
          .in('command', LIGHTS_COMMANDS)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('photoperiod_changes')
          .select('lights_on_hours')
          .eq('device_id', selectedDevice)
          .order('changed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (latestRes.error) throw latestRes.error
      if (pendingRes.error) throw pendingRes.error
      if (scheduleRes.error) throw scheduleRes.error

      const isOn = latestRes.data ? (latestRes.data.energy_wh ?? 0) > 0 : null
      const lastReading = latestRes.data?.datetime_utc
        ? new Date(latestRes.data.datetime_utc).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : null
      const pendingCommand = pendingRes.data?.command ?? null
      const schedule: number[] = Array.isArray(scheduleRes.data?.lights_on_hours)
        ? (scheduleRes.data!.lights_on_hours as number[])
        : []

      setState({ isOn, lastReading, pendingCommand, schedule, loading: false, error: null })
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
  }, [selectedDevice])

  return state
}
