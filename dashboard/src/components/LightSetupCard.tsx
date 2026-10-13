import { useEffect, useState } from 'react'
import { Card, Field, NumberInput, SaveRow, diff } from './FormBits'
import { sendSettingsCommand, type CommandOutcome, type DeviceConfig } from '../hooks/useDeviceConfig'
import type { LightSource } from '../hooks/useLightSource'

const ENVIRONMENTS = [
  { value: 'indoor', label: 'Fully indoors', hint: 'No sunlight reaches the plants.' },
  { value: 'greenhouse', label: 'Greenhouse', hint: 'Sunlight, with or without grow lights.' },
  { value: 'outdoor', label: 'Outdoors', hint: 'Sunlight only, or sunlight plus lights.' },
] as const

interface Props {
  config: DeviceConfig
  source: LightSource
  deviceId: string
  trial: string | null
  onDone: () => void
}

/**
 * How this grow gets its light. Maps to grow_cycle.json on the Pi:
 * ENVIRONMENT_TYPE, LIGHTS_INSTALLED, LIGHTS_PPFD_UMOL, LIGHTS_POWER_W.
 * The light sensor isn't a setting -- the Pi detects it, we just show it.
 */
export function LightSetupCard({ config, source, deviceId, trial, onDone }: Props) {
  const initial = {
    ENVIRONMENT_TYPE: (config.ENVIRONMENT_TYPE ?? 'indoor') as string,
    LIGHTS_INSTALLED: config.LIGHTS_INSTALLED !== false,
    LIGHTS_PPFD_UMOL: config.LIGHTS_PPFD_UMOL ?? 0,
    LIGHTS_POWER_W: config.LIGHTS_POWER_W ?? 0,
  }
  const [draft, setDraft] = useState(initial)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)

  useEffect(() => {
    setDraft(initial)
  }, [config.ENVIRONMENT_TYPE, config.LIGHTS_INSTALLED, config.LIGHTS_PPFD_UMOL, config.LIGHTS_POWER_W])

  const changes = diff(initial, draft)
  const valid =
    !draft.LIGHTS_INSTALLED ||
    (draft.LIGHTS_PPFD_UMOL >= 0 && draft.LIGHTS_PPFD_UMOL <= 2500 &&
     draft.LIGHTS_POWER_W >= 0 && draft.LIGHTS_POWER_W <= 5000)
  const sunlit = draft.ENVIRONMENT_TYPE !== 'indoor'

  async function save() {
    await sendSettingsCommand(deviceId, 'update_grow_config', { changes }, trial, o => {
      setOutcome(o)
      if (o.state === 'completed') onDone()
    })
  }

  return (
    <Card title="Light setup">
      <Field label="Where are the plants growing?">
        <div className="grid grid-cols-3 gap-2">
          {ENVIRONMENTS.map(e => (
            <button
              key={e.value}
              type="button"
              onClick={() => setDraft({ ...draft, ENVIRONMENT_TYPE: e.value })}
              aria-pressed={draft.ENVIRONMENT_TYPE === e.value}
              className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                draft.ENVIRONMENT_TYPE === e.value
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {ENVIRONMENTS.find(e => e.value === draft.ENVIRONMENT_TYPE)?.hint}
        </span>
      </Field>

      <label className="flex items-center gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={draft.LIGHTS_INSTALLED}
          onChange={e => setDraft({ ...draft, LIGHTS_INSTALLED: e.target.checked })}
          className="w-4 h-4 rounded accent-emerald-500"
        />
        LED grow lights are part of this system
      </label>

      {draft.LIGHTS_INSTALLED && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="LED intensity (µmol/m²/s)" hint="PPFD at the canopy when on, from the fixture spec sheet.">
            <NumberInput value={draft.LIGHTS_PPFD_UMOL} step={5} onChange={v => setDraft({ ...draft, LIGHTS_PPFD_UMOL: v })} />
          </Field>
          <Field label="Total LED watts" hint="All fixtures combined, when on. Used for energy cost.">
            <NumberInput value={draft.LIGHTS_POWER_W} step={1} onChange={v => setDraft({ ...draft, LIGHTS_POWER_W: v })} />
          </Field>
        </div>
      )}

      <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              source.sensorDetected ? 'bg-emerald-400' : source.sensorDetected === false ? 'bg-gray-300' : 'bg-gray-200'
            }`}
          />
          <span className="font-medium text-gray-700">
            Light sensor:{' '}
            {source.sensorDetected ? 'detected' : source.sensorDetected === false ? 'not detected' : 'unknown'}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {source.sensorDetected
            ? 'Light levels and DLI are measured.'
            : sunlit
              ? 'Without a sensor, Argonaut can\'t measure sunlight, so DLI isn\'t shown.'
              : draft.LIGHTS_INSTALLED
                ? 'Light levels and DLI are estimated from the LED intensity above, for the hours the lights actually run.'
                : 'No sensor and no grow lights: DLI will read zero.'}
        </p>
      </div>

      <SaveRow
        disabled={Object.keys(changes).length === 0 || !valid || outcome?.state === 'waiting'}
        outcome={outcome}
        onSave={save}
      />
    </Card>
  )
}
