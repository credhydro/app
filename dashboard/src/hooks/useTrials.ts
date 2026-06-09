import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useTrials(): string[] {
  const { selectedDevice } = useAuth()
  const [trials, setTrials] = useState<string[]>([])

  useEffect(() => {
    if (!selectedDevice) return
    supabase
      .rpc('distinct_trial_names', { p_device_id: selectedDevice })
      .then(({ data }) => {
        setTrials((data ?? []).map((r: { trial_name: string }) => r.trial_name))
      })
  }, [selectedDevice])

  return trials
}
