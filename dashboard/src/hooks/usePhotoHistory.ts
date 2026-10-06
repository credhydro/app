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

export function usePhotoHistory(refreshToken: number): PhotoHistoryState {
  const { selectedDevice } = useAuth()
  const [state, setState] = useState<PhotoHistoryState>({
    rows: [],
    loading: true,
    error: null,
  })

  async function fetch() {
    if (!selectedDevice) return
    try {
      const { data, error } = await supabase
        .from('photo_uploads')
        .select(PHOTO_UPLOAD_COLUMNS)
        .eq('device_id', selectedDevice)
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
  }, [selectedDevice, refreshToken])

  return state
}
