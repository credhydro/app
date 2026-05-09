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
