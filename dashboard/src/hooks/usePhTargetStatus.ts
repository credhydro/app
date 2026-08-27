import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface PhTargetStatus {
  /** Midpoint of the target pH range. */
  targetPh: number | null
  /** Half the width of the target pH range (range = targetPh +/- phMaxDelta). */
  phMaxDelta: number | null
  pendingCommand: string | null
  loading: boolean
  error: string | null
}

const DEFAULT_TARGET_PH = 6.0
const DEFAULT_PH_MAX_DELTA = 0.5
const REFRESH_MS = 30 * 1000

export function usePhTargetStatus(): PhTargetStatus {
  const { selectedDevice } = useAuth()
  const [state, setState] = useState<PhTargetStatus>({
    targetPh: null,
    phMaxDelta: null,
    pendingCommand: null,
    loading: true,
    error: null,
  })

  async function fetch() {
    if (!selectedDevice) return
    try {
      const [latestRes, pendingRes] = await Promise.all([
        supabase
          .from('commands')
          .select('params')
          .eq('device_id', selectedDevice)
          .eq('command', 'set_ph_target')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('commands')
          .select('command')
          .eq('device_id', selectedDevice)
          .eq('status', 'pending')
          .eq('command', 'set_ph_target')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (latestRes.error) throw latestRes.error
      if (pendingRes.error) throw pendingRes.error

      const params = latestRes.data?.params as
        | { target_ph?: number; ph_max_delta?: number }
        | undefined

      const targetPh = params?.target_ph ?? DEFAULT_TARGET_PH
      const phMaxDelta = params?.ph_max_delta ?? DEFAULT_PH_MAX_DELTA
      const pendingCommand = pendingRes.data?.command ?? null

      setState({ targetPh, phMaxDelta, pendingCommand, loading: false, error: null })
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
