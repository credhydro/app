import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface DoserAutoStatus {
  downEnabled: boolean
  upEnabled: boolean
  pendingDirection: 'down' | 'up' | null
  loading: boolean
  error: string | null
}

interface DoserAutoParams {
  direction?: 'down' | 'up'
  enabled?: boolean
}
interface CommandRow {
  params: DoserAutoParams | null
  status: string | null
}

const REFRESH_MS = 30 * 1000
const HISTORY_LIMIT = 20 // enough to find the latest row per direction

export function useDoserAutoStatus(): DoserAutoStatus {
  const { selectedDevice } = useAuth()
  const [state, setState] = useState<DoserAutoStatus>({
    downEnabled: false,
    upEnabled: false,
    pendingDirection: null,
    loading: true,
    error: null,
  })

  async function fetch() {
    if (!selectedDevice) return
    try {
      const { data, error } = await supabase
        .from('commands')
        .select('params, status')
        .eq('device_id', selectedDevice)
        .eq('command', 'set_doser_auto')
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)

      if (error) throw error

      const rows = (data ?? []) as CommandRow[]
      const latestFor = (direction: 'down' | 'up') =>
        rows.find(r => r.params?.direction === direction)

      const downEnabled = latestFor('down')?.params?.enabled ?? false
      const upEnabled = latestFor('up')?.params?.enabled ?? false

      const pending = rows.find(r => r.status === 'pending')
      const pendingDirection = pending?.params?.direction ?? null

      setState({ downEnabled, upEnabled, pendingDirection, loading: false, error: null })
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
