import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDeviceConfig } from './useDeviceConfig'
import { useTrials } from './useTrials'

const MAINTENANCE = 'maintenance'

/**
 * Which grow the growth views show. Default: the CURRENT grow (the unit's
 * ACTIVE_TRIAL) -- so a new grow starts with an empty photo list and a fresh
 * chart, and earlier grows are "archived" one tap away. The sidebar trial
 * picker, when set, still wins; a per-view choice wins over both.
 */
export function useGrowTrial() {
  const { selectedTrial } = useAuth()
  const { config } = useDeviceConfig()
  const trials = useTrials()
  const [choice, setChoice] = useState<string | null>(null)
  const active = config?.ACTIVE_TRIAL ?? null
  const current = active && active !== MAINTENANCE ? active : null
  const trial = choice ?? selectedTrial ?? current
  return {
    trial,                      // null = nothing chosen and no active grow -> show everything
    current,
    isCurrent: trial !== null && trial === current,
    options: Array.from(new Set([...(current ? [current] : []), ...trials])),
    setTrial: (t: string | null) => setChoice(t),
    loaded: config !== null,
  }
}
