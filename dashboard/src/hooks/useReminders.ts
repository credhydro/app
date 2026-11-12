import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sendSettingsCommand, type CommandOutcome } from './useDeviceConfig'

export interface Reminder {
  uuid: string
  text: string
  every_days: number
  source: string | null
  source_trial: string | null
  last_shown_date: string | null
}

/** Active daily-brief reminders for the selected unit, plus add/remove (commands to the unit). */
export function useReminders() {
  const { selectedDevice, selectedTrial } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!selectedDevice) return
    let cancelled = false
    supabase.from('grower_reminders')
      .select('uuid, text, every_days, source, source_trial, last_shown_date')
      .eq('device_id', selectedDevice).eq('active', true).order('datetime_utc', { ascending: true })
      .then(res => {
        if (cancelled) return
        setReminders((res.data ?? []) as Reminder[])
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [selectedDevice, tick])

  const add = useCallback((text: string, everyDays: number, sourceTrial: string | null, onUpdate: (o: CommandOutcome) => void) => {
    if (!selectedDevice) return
    sendSettingsCommand(selectedDevice, 'add_reminder', { text, every_days: everyDays, source_trial: sourceTrial },
      selectedTrial ?? null, o => { onUpdate(o); if (o.state === 'completed') refresh() })
  }, [selectedDevice, selectedTrial, refresh])

  const remove = useCallback((uuid: string, onUpdate: (o: CommandOutcome) => void) => {
    if (!selectedDevice) return
    sendSettingsCommand(selectedDevice, 'remove_reminder', { uuid }, selectedTrial ?? null,
      o => { onUpdate(o); if (o.state === 'completed') refresh() })
  }, [selectedDevice, selectedTrial, refresh])

  return { reminders, loaded, add, remove, refresh }
}

export const EVERY_OPTIONS = [1, 2, 3, 5, 7, 14, 30]
export function everyLabel(d: number): string {
  return d === 1 ? 'every day' : d === 7 ? 'every week' : d === 14 ? 'every 2 weeks' : d === 30 ? 'every month' : `every ${d} days`
}
