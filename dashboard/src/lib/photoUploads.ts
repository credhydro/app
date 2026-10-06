import { supabase } from './supabase'

const PHOTO_UPLOAD_COLUMNS =
  'id, device_id, trial_name, storage_path, original_name, size_bytes, created_at, status, qc_status, message, result, overlay_path'

export async function uploadPhotoOriginal(deviceId: string, token: string, file: File) {
  const storagePath = `${deviceId}/originals/${token}.jpg`
  const { error } = await supabase.storage
    .from('growth-photos')
    .upload(storagePath, file, { contentType: 'image/jpeg', upsert: false })
  return { storagePath, error }
}

export async function insertPhotoUploadRow(params: {
  deviceId: string
  storagePath: string
  originalName: string
  sizeBytes: number
  uploadedBy: string
  trialName: string | null
}) {
  return supabase
    .from('photo_uploads')
    .insert({
      device_id: params.deviceId,
      storage_path: params.storagePath,
      original_name: params.originalName,
      size_bytes: params.sizeBytes,
      uploaded_by: params.uploadedBy,
      trial_name: params.trialName,
    })
    .select(PHOTO_UPLOAD_COLUMNS)
    .single()
}

export async function getSignedOverlayUrl(overlayPath: string) {
  return supabase.storage.from('growth-photos').createSignedUrl(overlayPath, 3600)
}

export { PHOTO_UPLOAD_COLUMNS }
