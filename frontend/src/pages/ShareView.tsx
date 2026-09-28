import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent, WheelEvent as ReactWheelEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faDownload,
  faFileLines,
  faMinus,
  faPlus,
  faRotateLeft,
  faShareNodes
} from '@fortawesome/free-solid-svg-icons'
import ModelViewer from '../components/ModelViewer'
import ShareSkeleton from '../components/skeleton/ShareSkeleton'
import ShareSheet from '../components/ui/ShareSheet'
import VideoPlayer from '../components/ui/VideoPlayer'
import { getSharePlatforms } from '../components/ui/sharePlatforms'
import type { FileItem } from '../types'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const detectMimeFromBuffer = (buffer: ArrayBuffer): string | null => {
  const view = new Uint8Array(buffer)
  if (view.length >= 8) {
    if (
      view[0] === 0x89 &&
      view[1] === 0x50 &&
      view[2] === 0x4e &&
      view[3] === 0x47 &&
      view[4] === 0x0d &&
      view[5] === 0x0a &&
      view[6] === 0x1a &&
      view[7] === 0x0a
    ) {
      return 'image/png'
    }
    if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
      return 'image/jpeg'
    }
    if (view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x38) {
      return 'image/gif'
    }
    if (
      view[0] === 0x52 &&
      view[1] === 0x49 &&
      view[2] === 0x46 &&
      view[3] === 0x46 &&
      view[8] === 0x57 &&
      view[9] === 0x45 &&
      view[10] === 0x42 &&
      view[11] === 0x50
    ) {
      return 'image/webp'
    }
    if (view[0] === 0x42 && view[1] === 0x4d) {
      return 'image/bmp'
    }
  }
  try {
    const text = new TextDecoder().decode(view.slice(0, 256)).trim()
    if (text.startsWith('<svg') || text.startsWith('<?xml')) {
      return 'image/svg+xml'
    }
  } catch {
    return null
  }
  return null
}

const ShareView = () => {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const isFolderShare = location.pathname.startsWith('/s/folder/')
  const [blobUrl, setBlobUrl] = useState('')
  const [directUrl, setDirectUrl] = useState('')
  const [imageSrc, setImageSrc] = useState('')
  const [imageError, setImageError] = useState(false)
  const [fileType, setFileType] = useState('')
  const [filename, setFilename] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, x: 0, y: 0 })
  const pinchRef = useRef({ distance: 0, scale: 1 })
  const lastTapRef = useRef(0)

  useEffect(() => {
    let objectUrl = ''
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const shareBase = import.meta.env.DEV ? '/share-api' : '/s'
        const endpoint = isFolderShare ? `${shareBase}/folder/${token}` : `${shareBase}/${token}`
        setDirectUrl(endpoint)
        console.log('[ShareView] fetch endpoint', endpoint)
        const response = await fetch(endpoint)
        console.log('[ShareView] response', {
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get('content-type'),
          contentDisposition: response.headers.get('content-disposition')
        })
        if (!response.ok) {
          throw new Error('Share link tidak valid.')
        }
        const type = response.headers.get('content-type') || ''
        const disposition = response.headers.get('content-disposition') || ''
        const fileNameMatch = disposition.match(/filename="(.+)"/)
        const nameFromHeader = fileNameMatch ? fileNameMatch[1] : ''
        const blob = await response.blob()
        console.log('[ShareView] blob', { size: blob.size, type: blob.type })
        let resolvedType = type || blob.type || 'application/octet-stream'
        let resolvedBlob = blob
        if (resolvedType === 'application/octet-stream' || !resolvedType) {
          const buffer = await blob.arrayBuffer()
          const detected = detectMimeFromBuffer(buffer)
          console.log('[ShareView] sniffed mime', { detected })
          if (detected) {
            resolvedType = detected
            resolvedBlob = new Blob([buffer], { type: detected })
          }
        }
        objectUrl = URL.createObjectURL(resolvedBlob)
        console.log('[ShareView] objectUrl', objectUrl)
        setBlobUrl(objectUrl)
        setImageSrc(objectUrl)
        setImageError(false)
        setFileType(resolvedType)
        const fallbackName = isFolderShare ? 'shared-folder.zip' : 'shared-file'
        setFilename(nameFromHeader || fallbackName)
        setFileSize(resolvedBlob.size)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal membuka share link.')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [token, isFolderShare])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    if (!copySuccess) return
    const timer = setTimeout(() => setCopySuccess(false), 1800)
    return () => clearTimeout(timer)
  }, [copySuccess])

  useEffect(() => {
    if (!blobUrl) return
    setImageSrc(blobUrl)
    setImageError(false)
  }, [blobUrl])

  const lowerName = filename.toLowerCase()
  const hasImageExtension = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName)
  const hasVideoExtension = /\.(mp4|webm|ogg|mov|mkv)$/i.test(lowerName)
  const isModel = lowerName.endsWith('.glb') || lowerName.endsWith('.gltf') || lowerName.endsWith('.fbx')
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const isLargeModel = fileSize > 200 * 1024 * 1024
  const disableModelPreview = isMobile || isLargeModel
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const platforms = useMemo(() => getSharePlatforms(shareUrl), [shareUrl])
  const isImage = fileType.startsWith('image/') || hasImageExtension
  const isVideo = fileType.startsWith('video/') || hasVideoExtension
  const fileMeta = useMemo<FileItem>(
    () => ({
      publicId: '',
      fileType,
      size: fileSize,
      uploadedAt: undefined
    }),
    [fileSize, fileType]
  )

  const resetZoom = () => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }

  const applyScale = (value: number | ((prev: number) => number)) => {
    setScale((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      const clamped = clamp(next, 1, 5)
      if (clamped <= 1) {
        setTranslate({ x: 0, y: 0 })
      }
      return clamped
    })
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.2 : 0.2
    applyScale((prev) => prev + delta)
  }

  const startDrag = (clientX: number, clientY: number) => {
    if (scale <= 1) return
    setIsDragging(true)
    dragRef.current = { startX: clientX, startY: clientY, x: translate.x, y: translate.y }
  }

  const moveDrag = (clientX: number, clientY: number) => {
    if (!isDragging || scale <= 1) return
    const nextX = dragRef.current.x + (clientX - dragRef.current.startX)
    const nextY = dragRef.current.y + (clientY - dragRef.current.startY)
    setTranslate({ x: nextX, y: nextY })
  }

  const endDrag = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const a = event.touches[0]
      const b = event.touches[1]
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchRef.current = { distance, scale }
      return
    }
    const touch = event.touches[0]
    if (!touch) return
    const now = Date.now()
    if (now - lastTapRef.current < 260) {
      applyScale((prev) => (prev < 2 ? 2 : 1))
      lastTapRef.current = 0
      return
    }
    lastTapRef.current = now
    startDrag(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const a = event.touches[0]
      const b = event.touches[1]
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const nextScale = pinchRef.current.distance
        ? pinchRef.current.scale * (distance / pinchRef.current.distance)
        : scale
      applyScale(nextScale)
      return
    }
    const touch = event.touches[0]
    if (!touch) return
    moveDrag(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = () => {
    pinchRef.current = { distance: 0, scale }
    endDrag()
  }

  const handleShareCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopySuccess(true)
    } catch {
      setCopySuccess(false)
    }
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/drive')
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden dark:bg-[#161719]">
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 bg-slate-900/80 backdrop-blur dark:bg-[#151619]/80">
        <div className="min-w-0 flex items-center gap-4">
          <div className="flex items-center gap-2 text-white">
            <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
              <FontAwesomeIcon icon={faShareNodes} />
            </div>
            <div className="text-base font-semibold tracking-wide">PeakDrive</div>
          </div>
          <div className="hidden sm:block h-6 w-px bg-white/10" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{filename || 'Shared file'}</div>
            <div className="text-[11px] text-slate-400 truncate">{isFolderShare ? 'Share folder' : 'Share file'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShareSheetOpen(true)}
            className="h-9 px-3 rounded-full bg-white/10 text-white hover:bg-white/15 transition flex items-center gap-2 text-sm"
          >
            <FontAwesomeIcon icon={faShareNodes} />
            <span className="hidden sm:inline">Share</span>
          </button>
          <a
            href={blobUrl || '#'}
            download={filename}
            className={`h-9 px-3 rounded-full bg-white text-slate-900 hover:bg-slate-100 transition flex items-center gap-2 text-sm ${
              !blobUrl ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <FontAwesomeIcon icon={faDownload} />
            <span className="hidden sm:inline">Download</span>
          </a>
          <button
            onClick={handleBack}
            className="h-9 w-9 rounded-full border border-white/15 text-white hover:bg-white/10 transition flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-6 overflow-hidden">
        {loading && (
          <div className="w-full max-w-4xl">
            <ShareSkeleton />
          </div>
        )}
        {error && (
          <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        {!loading && !error && (
          <>
            {isImage && (
              <div className="relative w-full max-w-6xl h-[calc(100vh-8rem)] rounded-3xl border border-white/10 bg-slate-800 shadow-2xl overflow-hidden">
                <div
                  className={`absolute inset-0 flex items-center justify-center select-none ${
                    scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
                  }`}
                  onWheel={handleWheel}
                  onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => startDrag(event.clientX, event.clientY)}
                  onMouseMove={(event: ReactMouseEvent<HTMLDivElement>) => moveDrag(event.clientX, event.clientY)}
                  onMouseUp={endDrag}
                  onMouseLeave={endDrag}
                  onDoubleClick={() => applyScale((prev) => (prev < 2 ? 2 : 1))}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                >
                  <img
                    src={imageSrc}
                    alt={filename}
                    draggable={false}
                    onError={() => {
                      console.log('[ShareView] img error', { imageSrc, directUrl })
                      if (!imageError && directUrl) {
                        setImageError(true)
                        setImageSrc(directUrl)
                      }
                    }}
                    onLoad={(event: React.SyntheticEvent<HTMLImageElement>) => {
                      const { naturalWidth, naturalHeight, clientWidth, clientHeight } = event.currentTarget
                      console.log('[ShareView] img loaded', {
                        imageSrc,
                        naturalWidth,
                        naturalHeight,
                        clientWidth,
                        clientHeight
                      })
                    }}
                    className="block max-w-full max-h-full object-contain pointer-events-none"
                    style={{
                      transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
                      transition: isDragging ? 'none' : 'transform 180ms ease-out'
                    }}
                  />
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 backdrop-blur-md">
                  <button
                    onClick={() => applyScale((prev) => prev - 0.2)}
                    className="h-9 w-9 rounded-full text-white hover:bg-white/10 transition flex items-center justify-center"
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <button
                    onClick={resetZoom}
                    className="h-9 w-9 rounded-full text-white hover:bg-white/10 transition flex items-center justify-center"
                  >
                    <FontAwesomeIcon icon={faRotateLeft} />
                  </button>
                  <button
                    onClick={() => applyScale((prev) => prev + 0.2)}
                    className="h-9 w-9 rounded-full text-white hover:bg-white/10 transition flex items-center justify-center"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>
            )}
            {isVideo && (
              <div className="w-full max-w-6xl h-[82vh] rounded-3xl border border-white/10 bg-black/60 shadow-2xl overflow-hidden">
                <VideoPlayer src={blobUrl} name={filename} file={fileMeta} />
              </div>
            )}
            {isModel && !disableModelPreview && (
              <div className="w-full max-w-4xl h-[70vh] rounded-3xl border border-white/10 bg-white/5 shadow-2xl overflow-hidden">
                <ModelViewer url={blobUrl} format={lowerName} containerClassName="h-full" />
              </div>
            )}
            {isModel && disableModelPreview && (
              <div className="h-64 w-full max-w-3xl rounded-2xl border border-white/10 bg-white/5 flex flex-col items-center justify-center text-sm text-slate-300 gap-2">
                <FontAwesomeIcon icon={faFileLines} />
                Preview 3D dinonaktifkan
              </div>
            )}
            {!isImage && !isVideo && !isModel && (
              <div className="h-64 w-full max-w-3xl rounded-2xl border border-white/10 bg-white/5 flex flex-col items-center justify-center text-sm text-slate-300 gap-2">
                <FontAwesomeIcon icon={faFileLines} />
                Preview tidak tersedia
              </div>
            )}
          </>
        )}
      </div>
      <ShareSheet
        open={shareSheetOpen}
        shareUrl={shareUrl}
        loading={false}
        error=""
        copySuccess={copySuccess}
        onClose={() => setShareSheetOpen(false)}
        onCopy={handleShareCopy}
        platforms={platforms}
      />
    </div>
  )
}

export default ShareView
