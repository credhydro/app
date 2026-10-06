import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { uploadPhotoOriginal, insertPhotoUploadRow } from '../lib/photoUploads'

const MAX_SIZE_BYTES = 20 * 1024 * 1024

type SubmitPhase =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'uploadError'; message: string }
  | { kind: 'inserting'; storagePath: string; file: File }
  | { kind: 'insertError'; message: string; storagePath: string; file: File }

function validateFile(file: File): string | null {
  const type = file.type.toLowerCase()
  if (type !== 'image/jpeg') {
    if (type.includes('heic') || type.includes('heif') || type === 'image/png' || type === '') {
      return "This doesn't look like a JPEG. On iPhone, go to Settings → Camera → Formats and choose \"Most Compatible\", then retake the photo."
    }
    return 'Please choose a JPEG photo.'
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'That photo is too large (max 20 MB). Please retake without extra edits or filters.'
  }
  return null
}

export function PhotoCaptureForm({ onUploaded }: { onUploaded: (uploadId: string) => void }) {
  const { selectedDevice, selectedTrial, session } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [phase, setPhase] = useState<SubmitPhase>({ kind: 'idle' })

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileSelected(selected: File | null) {
    if (!selected) return
    const err = validateFile(selected)
    if (err) {
      setValidationError(err)
      setFile(null)
      setPhase({ kind: 'idle' })
      return
    }
    setValidationError(null)
    setFile(selected)
    setPhase({ kind: 'idle' })
  }

  const busy = phase.kind === 'uploading' || phase.kind === 'inserting'

  async function handleSubmit() {
    if (!file || !selectedDevice || !session || busy) return

    if (phase.kind === 'insertError') {
      setPhase({ kind: 'inserting', storagePath: phase.storagePath, file: phase.file })
      const { data, error } = await insertPhotoUploadRow({
        deviceId: selectedDevice,
        storagePath: phase.storagePath,
        originalName: phase.file.name,
        sizeBytes: phase.file.size,
        uploadedBy: session.user.id,
        trialName: selectedTrial,
      })
      if (error || !data) {
        setPhase({ kind: 'insertError', message: error?.message ?? 'Could not save this photo.', storagePath: phase.storagePath, file: phase.file })
        return
      }
      onUploaded(data.id as string)
      return
    }

    setPhase({ kind: 'uploading' })
    const token = crypto.randomUUID()
    const { storagePath, error: uploadError } = await uploadPhotoOriginal(selectedDevice, token, file)
    if (uploadError) {
      setPhase({ kind: 'uploadError', message: uploadError.message })
      return
    }

    setPhase({ kind: 'inserting', storagePath, file })
    const { data, error: insertError } = await insertPhotoUploadRow({
      deviceId: selectedDevice,
      storagePath,
      originalName: file.name,
      sizeBytes: file.size,
      uploadedBy: session.user.id,
      trialName: selectedTrial,
    })
    if (insertError || !data) {
      setPhase({ kind: 'insertError', message: insertError?.message ?? 'Could not save this photo.', storagePath, file })
      return
    }

    onUploaded(data.id as string)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Upload a Photo
      </h2>

      <div className="flex flex-col gap-3">
        <label className="py-3.5 text-base rounded-xl text-center font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer">
          Take photo
          <input
            type="file"
            accept="image/jpeg"
            capture="environment"
            className="sr-only"
            onChange={e => handleFileSelected(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="py-3.5 text-base rounded-xl text-center font-medium transition-colors bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer">
          Choose from library
          <input
            type="file"
            accept="image/jpeg"
            className="sr-only"
            onChange={e => handleFileSelected(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {validationError && <div className="text-sm text-red-500">{validationError}</div>}

      {previewUrl && (
        <img src={previewUrl} alt="Selected photo preview" className="w-full rounded-xl object-contain" />
      )}

      {phase.kind === 'uploadError' && <div className="text-sm text-red-500">{phase.message}</div>}
      {phase.kind === 'insertError' && <div className="text-sm text-red-500">{phase.message}</div>}

      {file && (
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40"
        >
          {phase.kind === 'uploading' ? 'Uploading…' : phase.kind === 'inserting' ? 'Saving…' : phase.kind === 'insertError' ? 'Retry' : 'Submit'}
        </button>
      )}
    </div>
  )
}
