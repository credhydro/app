export interface AmbientLatest {
  ph: number | null
  ec_us: number | null
  vpd_kpa: number | null
  datetime_utc: string
}

export interface AmbientData {
  latest: AmbientLatest | null
  dli: number | null
  assimilation: number | null
  totalCost: number | null
  loading: boolean
  error: string | null
}

export type PhotoUploadStatus = 'queued' | 'processing' | 'done' | 'error'
export type PhotoQcStatus = 'ok' | 'rejected' | null

export interface PhotoResultPlant {
  plant_id: string
  slot_id: string
  canopy_area_cm2: number | null
  prev_area_cm2: number | null
  days_since_prev: number | null
  change_pct: number | null
  rgr_pct_per_day: number | null
}

export interface PhotoResultSummary {
  n_plants: number
  mean_area_cm2: number
  spread_ratio: number
  days_since_prev: number | null
  mean_change_pct: number | null
}

export interface PhotoResult {
  schema: 1
  captured_utc: string
  tag_id: number | null
  plants: PhotoResultPlant[]
  summary: PhotoResultSummary | null
}

/** Row shape from photo_uploads. Pi-written `error` is intentionally never
 *  selected/typed here - it's admin-only and this feature never shows it. */
export interface PhotoUpload {
  id: string
  device_id: string
  trial_name: string | null
  storage_path: string
  original_name: string
  size_bytes: number
  created_at: string
  status: PhotoUploadStatus
  qc_status: PhotoQcStatus
  message: string | null
  result: PhotoResult | null
  overlay_path: string | null
}
