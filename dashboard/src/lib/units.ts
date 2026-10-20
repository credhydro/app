// Presentation-only unit helpers. Every database value stays in its native
// unit (airtemp_C is Celsius); convert only when showing it to a grower.

import type { DeviceConfig } from '../hooks/useDeviceConfig'

export type TempUnit = 'F' | 'C'

/** The grower's unit: their setting, else F for America/* timezones (same rule as the Pi). */
export function tempUnit(config: Pick<DeviceConfig, 'TEMP_UNIT' | 'TIMEZONE'> | null | undefined): TempUnit {
  if (config?.TEMP_UNIT === 'F' || config?.TEMP_UNIT === 'C') return config.TEMP_UNIT
  return config?.TIMEZONE?.startsWith('America/') ? 'F' : 'C'
}

/** Format a Celsius value from the database in the grower's unit, e.g. "68°F". */
export function formatTemp(celsius: number | null | undefined, unit: TempUnit, decimals = 0): string {
  if (celsius == null || Number.isNaN(celsius)) return '—'
  const v = unit === 'F' ? celsius * 9 / 5 + 32 : celsius
  return `${v.toFixed(decimals)}°${unit}`
}
