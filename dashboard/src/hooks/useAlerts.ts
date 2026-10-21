import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface Brief {
  summary: string
  worth_a_look?: string | null
  worth_a_look_tab?: 'lights' | 'ph' | 'pump' | 'fans' | 'photos' | 'settings' | null
  growth?: string | null
  based_on?: string[]
}

export interface AlertRow {
  uuid: string
  datetime_utc: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical' | string
  message: string
  resolved_at: string | null
  metadata: Record<string, unknown> | null
  /** Derived: closed by resolved_at or by a later recovery row (metadata.resolves_uuid). */
  resolved: boolean
  /** Cleared by a grower from the Alerts tab (public.alert_dismissals). */
  dismissed: boolean
}

export interface AlertsState {
  briefs: { at: string; brief: Brief }[]
  alerts: AlertRow[]          // everything except daily briefs, newest first
  activeCount: number         // unresolved, undismissed warning/critical from the last 7 days
  loading: boolean
  error: string | null
  dismiss: (uuids: string[]) => Promise<string | null>
  undismiss: (uuid: string) => Promise<string | null>
}

const WINDOW_DAYS = 30
const ACTIVE_DAYS = 7
const REFRESH_MS = 5 * 60 * 1000

function parseMeta(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'object') return raw as Record<string, unknown>
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

/**
 * Alerts + daily briefs for the selected device. Rows are written on the Pi
 * (pump_check.py, agent_daily_check.py) and arrive here via hourly sync.
 */
export function useAlerts(): AlertsState {
  const { selectedDevice } = useAuth()
  const [state, setState] = useState<Omit<AlertsState, 'dismiss' | 'undismiss'>>({ briefs: [], alerts: [], activeCount: 0, loading: true, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  async function dismiss(uuids: string[]): Promise<string | null> {
    if (!selectedDevice || uuids.length === 0) return null
    const { data: { user } } = await supabase.auth.getUser()
    const rows = uuids.map(u => ({ alert_uuid: u, device_id: selectedDevice, dismissed_by: user?.id }))
    const { error } = await supabase.from('alert_dismissals').upsert(rows, { onConflict: 'alert_uuid', ignoreDuplicates: true })
    setReloadKey(k => k + 1)
    return error?.message ?? null
  }

  async function undismiss(uuid: string): Promise<string | null> {
    const { error } = await supabase.from('alert_dismissals').delete().eq('alert_uuid', uuid)
    setReloadKey(k => k + 1)
    return error?.message ?? null
  }

  useEffect(() => {
    if (!selectedDevice) return
    let cancelled = false
    async function load() {
      const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
      const [res, dis] = await Promise.all([
        supabase
          .from('alerts')
          .select('uuid, datetime_utc, alert_type, severity, message, resolved_at, metadata')
          .eq('device_id', selectedDevice)
          .gte('datetime_utc', since)
          .order('datetime_utc', { ascending: false })
          .limit(300),
        supabase.from('alert_dismissals').select('alert_uuid').eq('device_id', selectedDevice),
      ])
      if (cancelled) return
      // If the dismissals table isn't there yet, alerts still show -- nothing counts as dismissed.
      const dismissedSet = new Set((dis.error ? [] : dis.data ?? []).map(d => d.alert_uuid as string))
      if (res.error) {
        setState(s => ({ ...s, loading: false, error: res.error.message }))
        return
      }
      const rows = (res.data ?? []).map(r => ({ ...r, metadata: parseMeta(r.metadata) }))
      const resolvedBy = new Set(
        rows.map(r => r.metadata?.resolves_uuid).filter((u): u is string => typeof u === 'string'),
      )
      const briefs = rows
        .filter(r => r.alert_type === 'daily_brief' && r.metadata?.brief)
        .map(r => ({ at: r.datetime_utc, brief: r.metadata!.brief as Brief }))
      const alerts: AlertRow[] = rows
        .filter(r => r.alert_type !== 'daily_brief')
        .map(r => ({ ...r, resolved: !!r.resolved_at || resolvedBy.has(r.uuid), dismissed: dismissedSet.has(r.uuid) }))
      const activeSince = Date.now() - ACTIVE_DAYS * 86400000
      const activeCount = alerts.filter(
        a => !a.resolved && !a.dismissed && (a.severity === 'warning' || a.severity === 'critical') &&
             new Date(a.datetime_utc).getTime() >= activeSince,
      ).length
      setState({ briefs, alerts, activeCount, loading: false, error: null })
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedDevice, reloadKey])

  return { ...state, dismiss, undismiss }
}

const TITLES: Record<string, string> = {
  nft_pump_no_flow: 'Pump: no water flow',
  nft_pump_recovered: 'Pump flow restored',
}

export function alertTitle(alertType: string): string {
  if (TITLES[alertType]) return TITLES[alertType]
  const ACRONYMS: Record<string, string> = { vpd: 'VPD', ph: 'pH', ec: 'EC', dli: 'DLI', ppfd: 'PPFD', nft: 'NFT', dwc: 'DWC', swc: 'SWC' }
  const words = alertType.split('_').filter(Boolean).map(w => ACRONYMS[w.toLowerCase()] ?? w.toLowerCase())
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const TAB_LINKS: Record<string, { to: string; label: string }> = {
  lights: { to: '/lights', label: 'Lights' },
  ph: { to: '/ph-dosing', label: 'pH Dosing' },
  pump: { to: '/pump', label: 'Pump' },
  fans: { to: '/fans', label: 'Fans' },
  photos: { to: '/growth-photos', label: 'Growth Photos' },
  settings: { to: '/settings', label: 'Settings' },
}
