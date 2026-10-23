import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface Brief {
  summary: string
  worth_a_look?: string | null
  worth_a_look_tab?: 'lights' | 'ph' | 'pump' | 'fans' | 'photos' | 'settings' | null
  growth?: string | null
  based_on?: string[]
}

/** Same keys as the unit's cause list. */
export const CAUSES: { key: string; label: string }[] = [
  { key: 'empty_dosing_reservoir', label: 'pH up/down reservoir empty' },
  { key: 'low_main_reservoir', label: 'Main reservoir low' },
  { key: 'blocked_line', label: 'Blocked or kinked line' },
  { key: 'probe_issue', label: 'Probe dry, dirty or needs calibration' },
  { key: 'equipment_failure', label: 'Equipment failure' },
  { key: 'power_or_network', label: 'Power or network outage' },
  { key: 'grower_action', label: 'Something I did (top-off, nutrient change)' },
  { key: 'environment', label: 'Environment (weather, HVAC)' },
  { key: 'false_alarm', label: 'False alarm' },
  { key: 'other', label: 'Other' },
]
export const MAX_CAUSES = 4

export function causeLabel(key: string): string {
  return CAUSES.find(c => c.key === key)?.label ?? key
}

/** The grower's "What was it?" note on an alert. */
export interface Resolution {
  causes: string[]
  note: string | null
  action_taken: string | null
  datetime_utc: string
}

export interface AlertRow {
  uuid: string
  datetime_utc: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical' | string
  message: string
  resolved_at: string | null
  metadata: Record<string, unknown> | null
  /** Derived: closed by resolved_at, a later recovery row (metadata.resolves_uuid), or a grower note. */
  resolved: boolean
  /** What the grower said caused it, if they've told us. */
  resolution: Resolution | null
  /** Hidden by the grower in this browser (localStorage only -- never saved anywhere). */
  dismissed: boolean
  /** Derived: a daily-brief finding from an earlier brief. Each morning's brief replaces the last one's findings. */
  superseded: boolean
}

export interface AlertsState {
  briefs: { at: string; brief: Brief }[]
  alerts: AlertRow[]          // everything except daily briefs, newest first
  activeCount: number         // unresolved, undismissed warning/critical from the last 7 days
  loading: boolean
  error: string | null
  dismiss: (uuids: string[]) => void
  undismiss: (uuid: string) => void
  /** Re-fetch now (e.g. right after saving a note). */
  refresh: () => void
}

// ---- in-browser dismissals ---------------------------------------------------
// A dismissal only hides that one alert row in this browser. A problem that
// comes back tomorrow is a new row, so it shows again. Entries older than
// KEEP_DAYS are pruned so the list can't grow forever.
const STORAGE_KEY = 'argonaut.dismissedAlerts.v1'
const KEEP_DAYS = 30

function readDismissed(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>
    const cutoff = Date.now() - KEEP_DAYS * 86400000
    return Object.fromEntries(Object.entries(raw).filter(([, t]) => typeof t === 'number' && t >= cutoff))
  } catch {
    return {}
  }
}

function writeDismissed(map: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // private window / storage blocked: dismissals just last until the page reloads
  }
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
  const [raw, setRaw] = useState<{ briefs: AlertsState['briefs']; rows: Omit<AlertRow, 'dismissed'>[]; loading: boolean; error: string | null }>({
    briefs: [], rows: [], loading: true, error: null,
  })
  const [dismissedMap, setDismissedMap] = useState<Record<string, number>>(() => readDismissed())

  function dismiss(uuids: string[]): void {
    if (uuids.length === 0) return
    const next = { ...readDismissed(), ...Object.fromEntries(uuids.map(u => [u, Date.now()])) }
    writeDismissed(next)
    setDismissedMap(next)
  }

  function undismiss(uuid: string): void {
    const next = { ...readDismissed() }
    delete next[uuid]
    writeDismissed(next)
    setDismissedMap(next)
  }

  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!selectedDevice) return
    let cancelled = false
    async function load() {
      const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
      const [res, resRes] = await Promise.all([
        supabase
          .from('alerts')
          .select('uuid, datetime_utc, alert_type, severity, message, resolved_at, metadata')
          .eq('device_id', selectedDevice)
          .gte('datetime_utc', since)
          .order('datetime_utc', { ascending: false })
          .limit(300),
        supabase
          .from('alert_resolutions')
          .select('alert_uuid, causes, note, action_taken, datetime_utc')
          .eq('device_id', selectedDevice)
          .gte('alert_datetime_utc', since)
          .limit(300),
      ])
      if (cancelled) return
      if (res.error) {
        setRaw(s => ({ ...s, loading: false, error: res.error.message }))
        return
      }
      // A missing alert_resolutions table (SQL not applied yet) just means no notes.
      const resolutions = new Map<string, Resolution>()
      for (const r of resRes.error ? [] : resRes.data ?? []) {
        let causes: string[] = []
        try {
          const parsed = typeof r.causes === 'string' ? JSON.parse(r.causes) : r.causes
          if (Array.isArray(parsed)) causes = parsed.map(String)
        } catch {
          // leave empty
        }
        resolutions.set(String(r.alert_uuid), {
          causes, note: r.note ?? null, action_taken: r.action_taken ?? null, datetime_utc: r.datetime_utc,
        })
      }
      const rows = (res.data ?? []).map(r => ({ ...r, metadata: parseMeta(r.metadata) }))
      const resolvedBy = new Set(
        rows.map(r => r.metadata?.resolves_uuid).filter((u): u is string => typeof u === 'string'),
      )
      const briefs = rows
        .filter(r => r.alert_type === 'daily_brief' && r.metadata?.brief)
        .map(r => ({ at: r.datetime_utc, brief: r.metadata!.brief as Brief }))
      // Findings from the daily brief only stand until the next brief. A finding is
      // written with the same timestamp as its brief, so anything older than the
      // latest brief belongs to an earlier one.
      const latestBriefMs = briefs.length ? new Date(briefs[0].at).getTime() : null
      const alertRows = rows
        .filter(r => r.alert_type !== 'daily_brief')
        .map(r => ({
          ...r,
          resolution: resolutions.get(r.uuid) ?? null,
          resolved: !!r.resolved_at || resolvedBy.has(r.uuid) || resolutions.has(r.uuid),
          superseded: r.metadata?.source === 'agent_daily_check' && latestBriefMs !== null &&
                      new Date(r.datetime_utc).getTime() < latestBriefMs,
        }))
      setRaw({ briefs, rows: alertRows, loading: false, error: null })
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedDevice, tick])

  const alerts: AlertRow[] = raw.rows.map(r => ({ ...r, dismissed: r.uuid in dismissedMap }))
  const activeSince = Date.now() - ACTIVE_DAYS * 86400000
  const activeCount = alerts.filter(
    a => !a.resolved && !a.dismissed && !a.superseded && (a.severity === 'warning' || a.severity === 'critical') &&
         new Date(a.datetime_utc).getTime() >= activeSince,
  ).length

  return { briefs: raw.briefs, alerts, activeCount, loading: raw.loading, error: raw.error, dismiss, undismiss, refresh }
}

/** Unresolved, undismissed, current warning/critical alerts from the last week (what the Home banner counts). */
export function activeAlerts(state: AlertsState): AlertRow[] {
  const since = Date.now() - ACTIVE_DAYS * 86400000
  return state.alerts.filter(
    a => !a.resolved && !a.dismissed && !a.superseded && (a.severity === 'warning' || a.severity === 'critical') &&
         new Date(a.datetime_utc).getTime() >= since,
  )
}

const TITLES: Record<string, string> = {
  nft_pump_no_flow: 'Pump: no water flow',
  nft_pump_recovered: 'Pump flow restored',
}

export function alertTitle(alertType: string): string {
  if (TITLES[alertType]) return TITLES[alertType]
  const ACRONYMS: Record<string, string> = { vpd: 'VPD', ph: 'pH', ec: 'EC', dli: 'DLI', ppfd: 'PPFD', nft: 'NFT', dwc: 'DWC', swc: 'SWC' }
  const parts = alertType.split('_').filter(Boolean)
  const words = parts.map(w => ACRONYMS[w.toLowerCase()] ?? w.toLowerCase())
  const text = words.join(' ')
  // Don't turn a leading acronym like "pH" into "PH".
  if (parts.length && ACRONYMS[parts[0].toLowerCase()]) return text
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
