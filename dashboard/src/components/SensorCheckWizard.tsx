import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { sendSettingsCommand, type CommandOutcome, type DeviceCommand } from '../hooks/useDeviceConfig'

type Sensor = 'ph' | 'ec'
type Step = 'intro' | 'dip' | 'reading' | 'result' | 'putback' | 'done'

interface CheckResult {
  check_uuid: string
  reading: number
  reference_value: number
  error: number
  error_unit: string
  stable: boolean
  can_apply: boolean
  too_far_off: boolean
}

const COPY: Record<Sensor, { title: string; need: string; dip: string; reference: string; refLabel: string }> = {
  ph: {
    title: '2-minute pH check',
    need: 'pH 7.00 buffer, a cup of distilled or clean water for rinsing, and a paper towel.',
    dip: 'Rinse the pH probe, blot it (don’t wipe the tip), and stand it in the pH 7.00 buffer. Wait about 30 seconds, then tap Read.',
    reference: 'ph7',
    refLabel: 'pH 7.00 buffer',
  },
  ec: {
    title: 'EC probe check',
    need: '1413 µS/cm conductivity standard, rinse water and a paper towel.',
    dip: 'Rinse the EC probe, shake it and blot it dry, then stand it in the 1413 standard. Tap the probe gently to knock off air bubbles, then tap Read.',
    reference: 'ec1413',
    refLabel: '1413 µS/cm standard',
  },
}

function fmtErr(r: CheckResult, sensor: Sensor): string {
  const sign = r.error > 0 ? '+' : ''
  return sensor === 'ph' ? `${sign}${r.error.toFixed(2)} pH` : `${sign}${r.error.toFixed(1)}%`
}

export function SensorCheckWizard({ sensor, onClose }: { sensor: Sensor; onClose: () => void }) {
  const { selectedDevice, selectedTrial } = useAuth()
  const copy = COPY[sensor]
  const [step, setStep] = useState<Step>('intro')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [applied, setApplied] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function send(command: DeviceCommand, params: Record<string, unknown>, onDone?: (r: Record<string, unknown> | null) => void) {
    if (!selectedDevice) return
    setBusy(true)
    setErr(null)
    sendSettingsCommand(selectedDevice, command, params, selectedTrial ?? null, (o: CommandOutcome) => {
      if (o.state === 'waiting') return
      setBusy(false)
      if (o.state === 'failed') setErr(o.message)
      else onDone?.(o.result)
    }, 4 * 60 * 1000)
  }

  function start() {
    // Don't wait: the grower rinses and dips while the unit picks this up.
    send('sensor_probe_out', { sensor, minutes: 15 })
    setStep('dip')
  }

  function read() {
    setResult(null)
    setStep('reading')
    send('sensor_check', { sensor, reference: copy.reference }, r => {
      setResult(r as unknown as CheckResult)
      setStep('result')
    })
  }

  function apply() {
    if (!result) return
    send('apply_sensor_offset', { check_uuid: result.check_uuid }, r => {
      setApplied(Number(r?.offset ?? result.error))
      setStep('putback')
    })
  }

  function backIn() {
    send('sensor_probe_in', { sensor }, () => setStep('done'))
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{copy.title}</h3>
        {step !== 'reading' && (
          <button onClick={onClose} className="text-xs font-medium text-gray-500 hover:text-gray-700">Close</button>
        )}
      </div>

      {step === 'intro' && (
        <>
          <p className="text-sm text-gray-600"><span className="font-medium">You’ll need:</span> {copy.need}</p>
          <p className="text-sm text-gray-600">
            While the probe is out, Argonaut stops logging {sensor === 'ph' ? 'pH and pauses pH dosing' : 'EC'} so the
            buffer reading never counts as your reservoir. It resumes on its own after 15 minutes if you forget to tell it.
          </p>
          <button onClick={start} className="self-start rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">
            Start — I’m taking the probe out
          </button>
        </>
      )}

      {step === 'dip' && (
        <>
          <p className="text-sm text-gray-700">{copy.dip}</p>
          <button onClick={read} className="self-start rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">
            Read the probe
          </button>
        </>
      )}

      {step === 'reading' && (
        <p className="text-sm text-gray-700">
          Reading the probe in the {copy.refLabel}… keep it still. This takes 1–2 minutes (Argonaut checks in once a
          minute, then takes several readings to make sure it has settled).
        </p>
      )}

      {step === 'result' && result && (
        <>
          <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5">
            <p className="text-sm text-gray-700">
              Reads <span className="font-semibold">{result.reading}</span> in the {copy.refLabel} —{' '}
              <span className="font-semibold">{fmtErr(result, sensor)}</span> off.
            </p>
            {!result.stable && <p className="mt-1 text-sm text-amber-700">The reading was still moving. Leave it a little longer and read again.</p>}
          </div>
          {result.stable && sensor === 'ph' && result.can_apply && (
            <p className="text-sm text-gray-600">
              Apply this as a correction? Argonaut will subtract {fmtErr(result, sensor)} from every pH reading (logging and
              dosing) until the next check or a fresh module.
            </p>
          )}
          {result.too_far_off && (
            <p className="text-sm text-red-700">
              That’s more than 1.0 off — too far for a correction to be trusted. Time for a fresh module.
            </p>
          )}
          {sensor === 'ec' && result.stable && (
            <p className="text-sm text-gray-600">
              {Math.abs(result.error) <= 10
                ? 'Within the expected range for this probe.'
                : 'More than 10% off. Try a gentle clean (rinse, soft brush in warm water) and check again; if it stays off, it’s due for a fresh module.'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {result.stable && result.can_apply && (
              <button onClick={apply} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
                {busy ? 'Applying…' : 'Apply correction'}
              </button>
            )}
            {!result.stable && (
              <button onClick={read} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Read again</button>
            )}
            <button onClick={() => setStep('putback')} disabled={busy} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 disabled:opacity-40">
              {result.stable && result.can_apply ? 'Don’t apply' : 'Continue'}
            </button>
          </div>
        </>
      )}

      {step === 'putback' && (
        <>
          {applied !== null && <p className="text-sm text-emerald-800">Correction of {applied > 0 ? '+' : ''}{applied.toFixed(2)} pH applied.</p>}
          <p className="text-sm text-gray-700">Rinse the probe and put it back in the reservoir, fully submerged.</p>
          <button onClick={backIn} disabled={busy} className="self-start rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
            {busy ? 'Telling Argonaut…' : 'It’s back in'}
          </button>
        </>
      )}

      {step === 'done' && (
        <>
          <p className="text-sm text-gray-700">All done — {sensor === 'ph' ? 'pH logging and dosing' : 'EC logging'} are back on. Thanks!</p>
          <button onClick={onClose} className="self-start text-sm font-medium text-emerald-700 hover:underline">Close</button>
        </>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  )
}
