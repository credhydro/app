import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Snapshot of a device's settings, written by the Pi into `device_config`
 * after every settings command. The phone number is only ever masked here.
 */
export interface DeviceConfig {
  TIMEZONE: string | null
  SYSTEM_TYPE: string | null
  PLANT_COUNT: number | null
  GROW_MEDIUM: string | null
  SYSTEM_VOLUME_GAL: number | null
  LIGHTS_PPFD_UMOL: number | null
  LIGHTS_POWER_W: number | null
  /** Missing on units that predate the Light setup panel -- treat as 'indoor'. */
  ENVIRONMENT_TYPE: 'indoor' | 'greenhouse' | 'outdoor' | null
  /** Missing on older units -- treat as true. */
  LIGHTS_INSTALLED: boolean | null
  CIRC_DURATION_MINS: number | null
  CIRC_LEAD_MINS: number | null
  /** ISO time the maintenance pause ends; null/past = not paused. */
  PUMP_PAUSED_UNTIL: string | null
  FAN_ON_MINS: number | null
  FAN_CYCLE_MINS: number | null
  /** Missing on older units -- treat as true. */
  FAN_LIGHTS_ON_ONLY: boolean | null
  FAN_WATTS: number | null
  FAN_OVERRIDE_MODE: 'on' | 'off' | null
  FAN_OVERRIDE_UNTIL: string | null
  PEAK_HOURS: number[] | null
  PEAK_RATE_SUMMER: number | null
  NONPEAK_RATE_SUMMER: number | null
  PEAK_RATE_WINTER: number | null
  NONPEAK_RATE_WINTER: number | null
  ACTIVE_TRIAL: string | null
  LIGHTS_ON_PERIOD: number[] | null
  TARGET_PH: number | null
  PH_MAX_DELTA: number | null
  DOSER_UP_ENABLED: boolean | null
  DOSER_DOWN_ENABLED: boolean | null
  FLOW_SENSOR_INSTALLED: boolean | null
  GROWER_NAME: string | null
  GROWER_PHONE_MASKED: string | null
  SMS_ALERTS: boolean | null
}

export const SETTINGS_COMMANDS = [
  'update_grow_config', 'set_grower_contact', 'report_config',
  'pump_pause', 'pump_resume', 'pump_run_cycle',
  'fan_override', 'fan_auto',
] as const

export interface DeviceConfigState {
  config: DeviceConfig | null
  updatedAt: string | null
  /** A settings command is queued or being processed by the Pi. */
  pending: boolean
  loading: boolean
  error: string | null
  refresh: () => void
}

const REFRESH_MS = 30 * 1000
const PENDING_REFRESH_MS = 5 * 1000

export function useDeviceConfig(): DeviceConfigState {
  const { selectedDevice, selectedTrial } = useAuth()
  const [config, setConfig] = useState<DeviceConfig | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Only auto-request a snapshot once per device per page visit.
  const requestedFor = useRef<string | null>(null)

  const fetchConfig = useCallback(async () => {
    if (!selectedDevice) return
    try {
      const [configRes, pendingRes] = await Promise.all([
        supabase
          .from('device_config')
          .select('config, updated_at')
          .eq('device_id', selectedDevice)
          .maybeSingle(),
        supabase
          .from('commands')
          .select('id')
          .eq('device_id', selectedDevice)
          .in('command', SETTINGS_COMMANDS as unknown as string[])
          .in('status', ['pending', 'claimed'])
          .limit(1),
      ])
      if (configRes.error) throw configRes.error
      if (pendingRes.error) throw pendingRes.error

      const hasPending = (pendingRes.data ?? []).length > 0
      setConfig((configRes.data?.config as DeviceConfig | undefined) ?? null)
      setUpdatedAt(configRes.data?.updated_at ?? null)
      setPending(hasPending)
      setError(null)

      // First visit for a device that has never reported: ask the Pi for a snapshot.
      if (!configRes.data && !hasPending && requestedFor.current !== selectedDevice) {
        requestedFor.current = selectedDevice
        await supabase.from('commands').insert({
          device_id: selectedDevice,
          command: 'report_config',
          params: null,
          trial_name: selectedTrial ?? null,
          status: 'pending',
        })
        setPending(true)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [selectedDevice, selectedTrial])

  useEffect(() => {
    setLoading(true)
    setConfig(null)
    fetchConfig()
  }, [fetchConfig])

  // Poll faster while the Pi is working on a settings command.
  useEffect(() => {
    const id = setInterval(fetchConfig, pending ? PENDING_REFRESH_MS : REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchConfig, pending])

  return { config, updatedAt, pending, loading, error, refresh: fetchConfig }
}

export type CommandOutcome =
  | { state: 'waiting' }
  | { state: 'completed'; result: Record<string, unknown> | null }
  | { state: 'failed'; message: string }

/**
 * Insert a settings command and resolve once the Pi has finished it
 * (or after timeoutMs, if the Pi never picks it up).
 */
export async function sendSettingsCommand(
  deviceId: string,
  command: (typeof SETTINGS_COMMANDS)[number],
  params: Record<string, unknown>,
  trialName: string | null,
  onUpdate: (o: CommandOutcome) => void,
  timeoutMs = 3 * 60 * 1000,
): Promise<void> {
  const { data, error } = await supabase
    .from('commands')
    .insert({ device_id: deviceId, command, params, trial_name: trialName, status: 'pending' })
    .select('id')
    .single()
  if (error || !data) {
    onUpdate({ state: 'failed', message: error?.message ?? 'Could not send to Argonaut' })
    return
  }

  onUpdate({ state: 'waiting' })
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await new Promise(r => setTimeout(r, 4000))
    const res = await supabase.from('commands').select('status, result').eq('id', data.id).single()
    if (res.error) continue
    const status = res.data.status as string
    const result = (res.data.result ?? null) as Record<string, unknown> | null
    if (status === 'completed') {
      onUpdate({ state: 'completed', result })
      return
    }
    if (status === 'failed' || status === 'rejected') {
      onUpdate({ state: 'failed', message: String(result?.error ?? 'Argonaut rejected the change') })
      return
    }
  }
  onUpdate({
    state: 'failed',
    message: "Argonaut hasn't picked this up yet. It will apply when the unit reconnects.",
  })
}
