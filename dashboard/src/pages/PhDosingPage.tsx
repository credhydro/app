import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePhTargetStatus } from '../hooks/usePhTargetStatus'
import { RangeSlider } from '../components/RangeSlider'
import { sendCommand } from '../lib/commands'

const SLIDER_MIN = 4
const SLIDER_MAX = 8
const SLIDER_STEP = 0.2

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

export function PhDosingPage() {
  const { selectedDevice, selectedTrial } = useAuth()
  const { targetPh, phMaxDelta, pendingCommand, loading, error } = usePhTargetStatus()

  const [draftLow, setDraftLow] = useState(5.5)
  const [draftHigh, setDraftHigh] = useState(6.5)
  const [sending, setSending] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (targetPh != null && phMaxDelta != null) {
      setDraftLow(round1(targetPh - phMaxDelta))
      setDraftHigh(round1(targetPh + phMaxDelta))
    }
  }, [targetPh, phMaxDelta])

  const changed =
    targetPh == null || phMaxDelta == null
      ? false
      : draftLow !== round1(targetPh - phMaxDelta) || draftHigh !== round1(targetPh + phMaxDelta)

  async function handleSave() {
    if (!selectedDevice || sending) return
    setSending(true)
    const { error } = await sendCommand(
      selectedDevice,
      'set_ph_target',
      {
        target_ph: round1((draftLow + draftHigh) / 2),
        ph_max_delta: round1((draftHigh - draftLow) / 2),
      },
      selectedTrial,
    )
    setSending(false)
    if (!error) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-700">pH Dosing</h1>

      {pendingCommand && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <ClockIcon />
          <span>
            <span className="font-medium">{pendingCommand}</span> — waiting for Pi to pick up
          </span>
        </div>
      )}

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Target pH Range
          </h2>
        </div>

        <RangeSlider
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={SLIDER_STEP}
          low={draftLow}
          high={draftHigh}
          onChange={(low, high) => {
            setDraftLow(low)
            setDraftHigh(high)
          }}
        />

        <p className="text-xs text-gray-400">
          Argonaut doses to keep pH within this range.
        </p>

        <button
          onClick={handleSave}
          disabled={sending || loading || !changed}
          className="mt-1 w-full py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40"
        >
          {sending ? 'Sending…' : saveSuccess ? 'Set ✓' : 'Set'}
        </button>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  )
}
