import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLightsStatus } from '../hooks/useLightsStatus'
import { sendCommand } from '../lib/commands'

function formatHour(h: number): string {
  if (h === 0) return '12AM'
  if (h < 12) return `${h}AM`
  if (h === 12) return '12PM'
  return `${h - 12}PM`
}

type Mode = 'on' | 'off' | 'auto'

export function LightsPage() {
  const { selectedDevice, selectedTrial } = useAuth()
  const { isOn, lastReading, pendingCommand, schedule, loading, error } = useLightsStatus()
  const [draftSchedule, setDraftSchedule] = useState<number[]>([])
  const [sending, setSending] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    setDraftSchedule(schedule)
  }, [schedule])

  async function handleMode(mode: Mode) {
    if (!selectedDevice || sending) return
    setSending(true)
    await sendCommand(selectedDevice, `lights_${mode}`, undefined, selectedTrial)
    setSending(false)
  }

  async function handleSaveSchedule() {
    if (!selectedDevice || sending) return
    setSending(true)
    const sorted = [...draftSchedule].sort((a, b) => a - b)
    const { error } = await sendCommand(
      selectedDevice,
      'set_lights_schedule',
      { lights_on_hours: sorted },
      selectedTrial,
    )
    setSending(false)
    if (!error) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  function toggleHour(h: number) {
    setDraftSchedule(prev =>
      prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h],
    )
  }

  const scheduleChanged =
    JSON.stringify([...draftSchedule].sort((a, b) => a - b)) !==
    JSON.stringify([...schedule].sort((a, b) => a - b))

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-700">Lights</h1>

      {/* Status */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full ${
              isOn === null ? 'bg-gray-300' : isOn ? 'bg-emerald-400' : 'bg-gray-300'
            }`}
          />
          <span className="text-sm font-medium text-gray-700">
            {isOn === null ? 'Unknown' : isOn ? 'On' : 'Off'}
          </span>
        </div>
        {lastReading && (
          <span className="text-xs text-gray-400">Last reading: {lastReading}</span>
        )}
      </div>

      {/* Pending command notice */}
      {pendingCommand && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
          <ClockIcon />
          <span>
            <span className="font-medium">{pendingCommand}</span> — waiting for Pi to pick up
          </span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      {/* Manual controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Manual Control</h2>
        <div className="flex gap-2">
          {(['on', 'auto', 'off'] as Mode[]).map(mode => (
            <button
              key={mode}
              onClick={() => handleMode(mode)}
              disabled={sending || loading}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-colors disabled:opacity-50 ${
                mode === 'on'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : mode === 'off'
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              {mode === 'auto' ? 'Auto (schedule)' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          On/Off override the schedule. Auto returns to the schedule below.
        </p>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Daily Schedule
          </h2>
          <span className="text-xs text-gray-400">
            {draftSchedule.length} hr{draftSchedule.length !== 1 ? 's' : ''} on
          </span>
        </div>

        {/* AM row */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">AM</p>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 12 }, (_, h) => (
              <button
                key={h}
                onClick={() => toggleHour(h)}
                className={`rounded py-2 text-xs font-medium transition-colors ${
                  draftSchedule.includes(h)
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {formatHour(h)}
              </button>
            ))}
          </div>
        </div>

        {/* PM row */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">PM</p>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 12 }, (_, i) => i + 12).map(h => (
              <button
                key={h}
                onClick={() => toggleHour(h)}
                className={`rounded py-2 text-xs font-medium transition-colors ${
                  draftSchedule.includes(h)
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {formatHour(h)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSaveSchedule}
          disabled={sending || !scheduleChanged}
          className="mt-1 w-full py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40"
        >
          {sending ? 'Sending…' : saveSuccess ? 'Schedule sent ✓' : 'Save Schedule'}
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
