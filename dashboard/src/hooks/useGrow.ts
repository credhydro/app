import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDeviceConfig } from './useDeviceConfig'
import type { PhotoResult } from '../types'

export const MAINTENANCE = 'maintenance'

/** The trials row for the active grow (columns from v11 may be missing on older tables). */
export interface TrialRow {
  trial_name: string
  crop_type: string | null
  cultivar?: string | null
  planting_date: string | null
  transplant_date?: string | null
  sow_date?: string | null
  germination?: string | null
  plant_count: number | null
  harvest_date: string | null
  harvest_type?: string | null
  grow_medium?: string | null
}

export interface HarvestRow {
  uuid: string
  trial_name: string
  harvest_date: string
  crop_type: string | null
  cultivar: string | null
  harvest_mass_g: number | null
  marketable_mass_g: number | null
  plants_surviving: number | null
  summary: string | null
}

/** Latest accepted photo for this grow: per-plant areas for the harvest weigh-in. */
export interface LatestPhoto {
  captured_utc: string
  plants: { plant_id: string; canopy_area_cm2: number | null }[]
}

/** Day 0 of the crop: transplant date when recorded, else the trial's planting date. */
export function day0Of(t: TrialRow | null): string | null {
  return t?.transplant_date || t?.planting_date || null
}

export function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null
  const d0 = new Date(`${isoDate.slice(0, 10)}T00:00:00`).getTime()
  return Math.floor((Date.now() - d0) / 86400000)
}

export function useGrow() {
  const { selectedDevice } = useAuth()
  const { config, pending: configPending, refresh: refreshConfig } = useDeviceConfig()
  const active = config?.ACTIVE_TRIAL ?? null
  const [trial, setTrial] = useState<TrialRow | null>(null)
  const [lastHarvest, setLastHarvest] = useState<HarvestRow | null>(null)
  const [latestPhoto, setLatestPhoto] = useState<LatestPhoto | null>(null)
  const [trialNames, setTrialNames] = useState<string[]>([])
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => { setTick(t => t + 1); refreshConfig() }, [refreshConfig])

  useEffect(() => {
    if (!selectedDevice) return
    let cancelled = false
    async function load() {
      const [t, h, names, photo] = await Promise.all([
        active && active !== MAINTENANCE
          ? supabase.from('trials').select('*').eq('trial_name', active).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('harvests')
          .select('uuid, trial_name, harvest_date, crop_type, cultivar, harvest_mass_g, marketable_mass_g, plants_surviving, summary')
          .eq('device_id', selectedDevice).order('harvest_date', { ascending: false }).limit(1),
        supabase.from('trials').select('trial_name').limit(1000),
        active && active !== MAINTENANCE
          ? supabase.from('photo_uploads').select('result')
              .eq('device_id', selectedDevice).eq('trial_name', active)
              .eq('status', 'done').eq('qc_status', 'ok')
              .order('created_at', { ascending: false }).limit(1)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (cancelled) return
      setTrial((t.data as TrialRow | null) ?? null)
      setLastHarvest(h.error ? null : ((h.data?.[0] as HarvestRow | undefined) ?? null))
      setTrialNames(((names.data ?? []) as { trial_name: string }[]).map(r => r.trial_name))
      const res = (photo.data?.[0] as { result: PhotoResult | null } | undefined)?.result
      setLatestPhoto(res ? { captured_utc: res.captured_utc, plants: res.plants.map(p => ({ plant_id: p.plant_id, canopy_area_cm2: p.canopy_area_cm2 })) } : null)
    }
    load()
    const id = setInterval(load, 30 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [selectedDevice, active, tick])

  return { active, trial, lastHarvest, latestPhoto, trialNames, configPending, configLoaded: config !== null, refresh }
}

/** Next free name of the form trial_NNN. trial_name is unique across every unit in Supabase. */
export function suggestTrialName(names: string[]): string {
  const nums = names.map(n => /^trial_(\d+)$/.exec(n)?.[1]).filter(Boolean).map(Number)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `trial_${String(next).padStart(3, '0')}`
}
