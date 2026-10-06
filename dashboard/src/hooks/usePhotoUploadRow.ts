import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PHOTO_UPLOAD_COLUMNS } from '../lib/photoUploads'
import type { PhotoUpload } from '../types'

export interface PhotoUploadRowState {
  row: PhotoUpload | null
  loading: boolean
  error: string | null
}

const POLL_MS = 3000

export function usePhotoUploadRow(uploadId: string | null): PhotoUploadRowState {
  const [state, setState] = useState<PhotoUploadRowState>({
    row: null,
    loading: false,
    error: null,
  })
  const statusRef = useRef<PhotoUpload['status'] | null>(null)

  useEffect(() => {
    if (!uploadId) {
      statusRef.current = null
      setState({ row: null, loading: false, error: null })
      return
    }

    let cancelled = false
    statusRef.current = null

    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('photo_uploads')
          .select(PHOTO_UPLOAD_COLUMNS)
          .eq('id', uploadId)
          .single()

        if (error) throw error
        if (cancelled) return

        const row = data as unknown as PhotoUpload
        statusRef.current = row.status
        setState({ row, loading: false, error: null })
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e)
        setState(prev => ({ ...prev, loading: false, error: msg }))
      }
    }

    setState(prev => ({ ...prev, loading: true }))
    fetch()

    const id = setInterval(() => {
      if (statusRef.current === 'done' || statusRef.current === 'error') {
        clearInterval(id)
        return
      }
      fetch()
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [uploadId])

  return state
}
