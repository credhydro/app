import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PHOTO_UPLOAD_COLUMNS } from '../lib/photoUploads'
import { useAuth } from '../context/AuthContext'
import type { PhotoUpload } from '../types'

export interface PhotoHistoryState {
  rows: PhotoUpload[]
  loading: boolean
  error: string | null
}

const HISTORY_LIMIT = 20

/** Recent uploads for one grow (trial); null = every upload for the unit. */
export function usePhotoHistory(refreshToken: number, trialName: string | null | undefined = null): PhotoHistoryState {
  const { selectedDevice } = useAuth()
  const [state, setState] = useState<PhotoHistoryState>({
    rows: [],
    loading: true,
    error: null,
  })

  async function fetch() {
    if (!selectedDevice || trialName === undefined) return      // undefined = still deciding which grow
    try {
      let q = supabase
        .from('photo_uploads')
        .select(PHOTO_UPLOAD_COLUMNS)
        .eq('device_id', selectedDevice)
      if (trialName) q = q.eq('trial_name', trialName)
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)

      if (error) throw error

      setState({ rows: (data ?? []) as unknown as PhotoUpload[], loading: false, error: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e)
      setState(prev => ({ ...prev, loading: false, error: msg }))
    }
  }

  useEffect(() => {
    setState(prev => ({ ...prev, loading: true }))
    fetch()
  }, [selectedDevice, refreshToken, trialName])

  return state
}
