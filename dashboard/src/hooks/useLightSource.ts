import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export type EnvironmentType = 'indoor' | 'greenhouse' | 'outdoor'

export interface LightSource {
  environment: EnvironmentType
  lightsInstalled: boolean
  /** Latest ambient reading came from a live light (quantum) sensor. null = unknown. */
  sensorDetected: boolean | null
}

/**
 * Read-only view of how a device gets its light numbers: environment and
 * LEDs from the Pi's device_config snapshot, sensor presence from the
 * latest ambient_raw.ppfd_flag (> 0 means a live sensor reading, 0 means the
 * PPFD was estimated from LED settings). Defaults match the Pi's defaults
 * for units that predate these settings: indoor, LEDs installed.
 */
export function useLightSource(): LightSource {
  const { selectedDevice } = useAuth()
  const [state, setState] = useState<LightSource>({ environment: 'indoor', lightsInstalled: true, sensorDetected: null })

  useEffect(() => {
    if (!selectedDevice) return
    let cancelled = false
    async function load() {
      const [cfgRes, ppfdRes] = await Promise.all([
        supabase.from('device_config').select('config').eq('device_id', selectedDevice).maybeSingle(),
        supabase
          .from('ambient_raw')
          .select('ppfd_flag')
          .eq('device_id', selectedDevice)
          .order('datetime_utc', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (cancelled) return
      const cfg = (cfgRes.data?.config ?? {}) as { ENVIRONMENT_TYPE?: string | null; LIGHTS_INSTALLED?: boolean | null }
      const env = cfg.ENVIRONMENT_TYPE
      setState({
        environment: env === 'greenhouse' || env === 'outdoor' ? env : 'indoor',
        lightsInstalled: cfg.LIGHTS_INSTALLED !== false,
        // A failed query (e.g. column not synced yet) just leaves this unknown.
        sensorDetected: ppfdRes.error || !ppfdRes.data ? null : (ppfdRes.data.ppfd_flag ?? 0) > 0,
      })
    }
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedDevice])

  return state
}

/** What the DLI gauge should say about where its number came from. */
export function dliDescription(src: LightSource, dli: number | null): { note: string | null; emptyText: string } {
  const sunlit = src.environment !== 'indoor'
  if (src.sensorDetected) return { note: 'Last photoperiod · measured', emptyText: 'Available after the first full photoperiod' }
  if (sunlit) return { note: null, emptyText: 'Connect a light sensor to measure sunlight' }
  if (!src.lightsInstalled) return { note: 'Last photoperiod · no grow lights', emptyText: 'Available after the first full photoperiod' }
  return { note: dli != null ? 'Last photoperiod · estimated from LEDs' : null, emptyText: 'Available after the first full photoperiod' }
}
