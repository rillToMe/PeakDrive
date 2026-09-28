import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent, WheelEvent as ReactWheelEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleInfo,
  faFileArrowDown,
  faCompress,
  faExpand,
  faMinus,
  faPlus,
  faRotateLeft,
  faTrash,
  faXmark
} from '@fortawesome/free-solid-svg-icons'
import { formatBytes } from '../../services/driveUtils'
import type { FileItem } from '../../types'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

interface ImageViewerModalProps {
  open: boolean
  name: string
  src: string
  file?: FileItem | null
  onClose: () => void
  onDownload?: (file: FileItem) => void
  onDelete?: (file: FileItem) => void
  openAt: number
}

type ScaleInput = number | ((prev: number) => number)

const ImageViewerModal = ({
  open,
  name,
  src,
  file,
  onClose,
  onDownload,
  onDelete,
  openAt
}: ImageViewerModalProps) => {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [infoOpen, setInfoOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, x: 0, y: 0 })
  const pinchRef = useRef({ distance: 0, scale: 1 })
  const lastTapRef = useRef(0)
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (document.fullscreenElement) {
        document.exitFullscreen?.()
      }
    }
  }, [open])

  const sizeLabel = file?.size ? formatBytes(file.size) : '-'
  const uploadedAt = file?.uploadedAt || file?.createdAt || file?.updatedAt
  const uploadedLabel = uploadedAt ? new Date(uploadedAt).toLocaleString() : '-'
  const dimensionLabel =
    dimensions.width && dimensions.height ? `${dimensions.width}×${dimensions.height}` : '-'
  const dpiLabel = file?.dpi || file?.metadata?.dpi || file?.meta?.dpi || '-'
  const bitDepthLabel = file?.bitDepth || file?.metadata?.bitDepth || file?.meta?.bitDepth || '-'
  const infoInline = dimensionLabel !== '-' ? `${dimensionLabel} • ${sizeLabel}` : sizeLabel

  const applyScale = (value: ScaleInput) => {
    setScale((prev) => {
      const nextScale = typeof value === 'function' ? value(prev) : value
      const clamped = clamp(nextScale, 1, 5)
      if (clamped <= 1) {
        setTranslate({ x: 0, y: 0 })
      }
      return clamped
    })
  }

  const zoomIn = () => applyScale((prev) => prev + 0.2)
  const zoomOut = () => applyScale((prev) => prev - 0.2)
  const resetZoom = () => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }

  const toggleFullscreen = async () => {
    const target = modalRef.current
    if (!target) return
    if (document.fullscreenElement) {
      await document.exitFullscreen?.()
      return
    }
    if (target.requestFullscreen) {
      await target.requestFullscreen()
    }
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
      const [a, b] = [event.touches[0], event.touches[1]]
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchRef.current = { distance, scale }
      return
    }
    const touch = event.touches[0]
    if (!touch) return
    const now = Date.now()
    const rect = event.currentTarget.getBoundingClientRect()
    if (now - lastTapRef.current < 260) {
      if (touch.clientX - rect.left < rect.width / 2) {
        zoomOut()
      } else {
        zoomIn()
      }
      lastTapRef.current = 0
      return
    }
    lastTapRef.current = now
    startDrag(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]]
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

  const infoDetails = useMemo(
    () => [
      { label: 'Nama file', value: name || '-' },
      { label: 'Tanggal upload', value: uploadedLabel },
      { label: 'Dimensi (px)', value: dimensionLabel },
      { label: 'Size', value: sizeLabel },
      { label: 'DPI', value: String(dpiLabel) },
      { label: 'Bit depth', value: String(bitDepthLabel) }
    ],
    [name, uploadedLabel, dimensionLabel, sizeLabel, dpiLabel, bitDepthLabel]
  )

  if (!open || !src) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={() => {
        if (Date.now() - openAt < 300) return
        onClose()
      }}
    >
      <div
        ref={modalRef}
        className="relative w-[96vw] max-w-6xl h-[92vh] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1F2023] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-700/80 dark:bg-[#1F2023]/80">
          <div className="min-w-0">
            <div className="text-[0.95rem] font-semibold text-slate-900 truncate dark:text-slate-100">{name}</div>
            <div className="text-xs text-slate-500/90 dark:text-slate-400/90">{infoInline}</div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div className="relative flex-1 min-h-0 bg-black overflow-hidden">
          <div
            className={`absolute inset-0 flex items-center justify-center select-none touch-none ${
              scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
            }`}
            onWheel={handleWheel}
            onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => startDrag(event.clientX, event.clientY)}
            onMouseMove={(event: ReactMouseEvent<HTMLDivElement>) => moveDrag(event.clientX, event.clientY)}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onDoubleClick={() => {
              if (scale < 2) {
                applyScale(2)
                return
              }
              resetZoom()
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <img
              src={src}
              alt={name}
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget
                setDimensions({ width: naturalWidth, height: naturalHeight })
              }}
              className="max-w-full max-h-full object-contain select-none pointer-events-none"
              style={{
                transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 180ms ease-out'
              }}
            />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-lg backdrop-blur-md text-slate-700 dark:bg-[#1F2023]/80 dark:text-slate-200">
            <div className="relative group">
              <button
                onClick={zoomOut}
                className="h-9 w-9 rounded-full hover:bg-slate-100 transition flex items-center justify-center dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 rounded-full bg-slate-900/90 text-white text-[11px] px-2.5 py-1 text-center shadow-lg backdrop-blur-sm opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none dark:bg-slate-100/90 dark:text-slate-900">
                Zoom out
              </div>
            </div>
            <div className="relative group">
              <button
                onClick={zoomIn}
                className="h-9 w-9 rounded-full hover:bg-slate-100 transition flex items-center justify-center dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 rounded-full bg-slate-900/90 text-white text-[11px] px-2.5 py-1 text-center shadow-lg backdrop-blur-sm opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none dark:bg-slate-100/90 dark:text-slate-900">
                Zoom in
              </div>
            </div>
            <div className="relative group">
              <button
                onClick={resetZoom}
                className="h-9 w-9 rounded-full hover:bg-slate-100 transition flex items-center justify-center dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faRotateLeft} />
              </button>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 rounded-full bg-slate-900/90 text-white text-[11px] px-2.5 py-1 text-center shadow-lg backdrop-blur-sm opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none dark:bg-slate-100/90 dark:text-slate-900">
                Reset
              </div>
            </div>
            <div className="relative group">
              <button
                onClick={toggleFullscreen}
                className="h-9 w-9 rounded-full hover:bg-slate-100 transition flex items-center justify-center dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
              </button>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 rounded-full bg-slate-900/90 text-white text-[11px] px-2.5 py-1 text-center shadow-lg backdrop-blur-sm opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none dark:bg-slate-100/90 dark:text-slate-900">
                {isFullscreen ? 'Exit full screen' : 'Full screen'}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200/80 dark:bg-slate-700/80" />
            <div className="relative group">
              <button
                onClick={() => file && onDownload?.(file)}
                className="h-9 w-9 rounded-full hover:bg-slate-100 transition flex items-center justify-center dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faFileArrowDown} />
              </button>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 rounded-full bg-slate-900/90 text-white text-[11px] px-2.5 py-1 text-center shadow-lg backdrop-blur-sm opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none dark:bg-slate-100/90 dark:text-slate-900">
                Download
              </div>
            </div>
            <div className="relative group">
              <button
                onClick={() => file && onDelete?.(file)}
                className="h-9 w-9 rounded-full text-rose-600 hover:bg-rose-50 transition flex items-center justify-center dark:text-rose-300 dark:hover:bg-rose-500/10"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 rounded-full bg-slate-900/90 text-white text-[11px] px-2.5 py-1 text-center shadow-lg backdrop-blur-sm opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none dark:bg-slate-100/90 dark:text-slate-900">
                Delete
              </div>
            </div>
            <div className="relative group">
              <button
                onClick={() => setInfoOpen((value) => !value)}
                className={`h-9 w-9 rounded-full transition flex items-center justify-center ${
                  infoOpen
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'hover:bg-slate-100 dark:hover:bg-[#2a2c30]'
                }`}
              >
                <FontAwesomeIcon icon={faCircleInfo} />
              </button>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 rounded-full bg-slate-900/90 text-white text-[11px] px-2.5 py-1 text-center shadow-lg backdrop-blur-sm opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none dark:bg-slate-100/90 dark:text-slate-900">
                Info
              </div>
            </div>
          </div>
          <div
            className={`absolute inset-y-0 right-0 w-80 max-w-[85vw] border-l border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl transition-all duration-300 ease-out flex flex-col ${
              infoOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
            } dark:border-slate-700 dark:bg-[#1F2023]/95`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 dark:border-slate-700/80">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Info File</div>
              <button
                onClick={() => setInfoOpen(false)}
                className="h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 text-sm text-slate-700 dark:text-slate-200">
              {infoDetails.map((item) => (
                <div key={item.label}>
                  <div className="text-xs text-slate-500/80 dark:text-slate-400/80 mb-1">{item.label}</div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageViewerModal
