import { useAuth } from '../context/AuthContext'

export function DevicePicker() {
  const { devices, selectedDevice, setSelectedDevice } = useAuth()

  return (
    <div className="px-3 py-2">
      <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
        Device
      </label>
      <select
        value={selectedDevice ?? ''}
        onChange={e => setSelectedDevice(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        {devices.map(d => (
          <option key={d.device_id} value={d.device_id}>{d.label}</option>
        ))}
      </select>
    </div>
  )
}
