import { useEffect, useState } from 'react'
import { getSignedOverlayUrl } from '../lib/photoUploads'

export function PhotoOverlayImage({ overlayPath }: { overlayPath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setFailed(false)

    getSignedOverlayUrl(overlayPath).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) {
        setFailed(true)
        return
      }
      setUrl(data.signedUrl)
    })

    return () => {
      cancelled = true
    }
  }, [overlayPath])

  if (failed) {
    return <div className="text-xs text-gray-400">Image unavailable</div>
  }

  if (!url) {
    return <div className="w-full aspect-[4/3] rounded-xl bg-gray-100 animate-pulse" />
  }

  return (
    <img
      src={url}
      alt="Analysis overlay"
      className="w-full rounded-xl object-contain"
    />
  )
}
