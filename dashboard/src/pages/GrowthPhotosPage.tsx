import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePhotoUploadRow } from '../hooks/usePhotoUploadRow'
import { usePhotoHistory } from '../hooks/usePhotoHistory'
import { PhotoInstructionsCard } from '../components/PhotoInstructionsCard'
import { PhotoCaptureForm } from '../components/PhotoCaptureForm'
import { PhotoStatusView } from '../components/PhotoStatusView'
import { PhotoHistoryList } from '../components/PhotoHistoryList'
import { PhotoDeviceEmptyState } from '../components/PhotoDeviceEmptyState'
import type { PhotoUploadStatus } from '../types'

export function GrowthPhotosPage() {
  const { selectedDevice, session } = useAuth()
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null)
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0)

  const { row, loading: rowLoading, error: rowError } = usePhotoUploadRow(activeUploadId)
  const { rows: history, loading: historyLoading, error: historyError } = usePhotoHistory(historyRefreshToken)

  const lastStatusRef = useRef<PhotoUploadStatus | null>(null)
  useEffect(() => {
    if (!row) return
    if (
      (row.status === 'done' || row.status === 'error') &&
      lastStatusRef.current !== row.status
    ) {
      lastStatusRef.current = row.status
      setHistoryRefreshToken(t => t + 1)
    }
    if (row.status === 'queued' || row.status === 'processing') {
      lastStatusRef.current = row.status
    }
  }, [row])

  if (!session) return null

  if (!selectedDevice) {
    return (
      <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-700">Growth Photos</h1>
        <PhotoDeviceEmptyState />
      </div>
    )
  }

  const showInstructions = activeUploadId == null || row?.qc_status === 'rejected'

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-700">Growth Photos</h1>

      {showInstructions && <PhotoInstructionsCard />}

      {activeUploadId == null ? (
        <PhotoCaptureForm
          onUploaded={id => {
            setActiveUploadId(id)
            setHistoryRefreshToken(t => t + 1)
          }}
        />
      ) : (
        <PhotoStatusView
          row={row}
          loading={rowLoading}
          error={rowError}
          onRetake={() => setActiveUploadId(null)}
        />
      )}

      <PhotoHistoryList
        rows={history}
        loading={historyLoading}
        error={historyError}
        activeId={activeUploadId}
        onSelect={setActiveUploadId}
      />
    </div>
  )
}
