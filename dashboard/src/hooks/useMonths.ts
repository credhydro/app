import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useMonths(): string[] {
  const { selectedDevice } = useAuth()
  const [months, setMonths] = useState<string[]>([])

  useEffect(() => {
    if (!selectedDevice) return
    Promise.all([
      supabase.from('ambient_raw').select('datetime_utc').eq('device_id', selectedDevice).order('datetime_utc').limit(1),
      supabase.from('ambient_raw').select('datetime_utc').eq('device_id', selectedDevice).order('datetime_utc', { ascending: false }).limit(1),
    ]).then(([minRes, maxRes]) => {
      const minRow = minRes.data?.[0]
      const maxRow = maxRes.data?.[0]
      if (!minRow || !maxRow) return

      const min = new Date(minRow.datetime_utc)
      const max = new Date(maxRow.datetime_utc)
      const result: string[] = []
      const cur = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1))
      const end = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), 1))

      while (cur <= end) {
        result.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`)
        cur.setUTCMonth(cur.getUTCMonth() + 1)
      }

      result.reverse()
      setMonths(result)
    })
  }, [selectedDevice])

  return months
}

export function monthRange(yyyyMm: string): { gte: string; lt: string } {
  const [y, m] = yyyyMm.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  return { gte: start.toISOString(), lt: end.toISOString() }
}

export function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
