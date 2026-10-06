import { PhotoIcon } from './Sidebar'

export function PhotoDeviceEmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-2 text-center">
      <span className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
        <PhotoIcon />
      </span>
      <h2 className="text-sm font-semibold text-gray-500">No device assigned</h2>
      <p className="text-xs text-gray-400">
        Ask an admin to assign a device to your account before uploading growth photos.
      </p>
    </div>
  )
}
