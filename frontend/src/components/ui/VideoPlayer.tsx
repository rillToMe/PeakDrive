import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBackward,
  faCircleInfo,
  faEllipsisVertical,
  faExpand,
  faXmark,
  faFileArrowDown,
  faForward,
  faPause,
  faPlay,
  faShareNodes,
  faTrash,
  faVolumeHigh,
  faVolumeXmark
} from '@fortawesome/free-solid-svg-icons'
import { formatBytes } from '../../services/driveUtils'
import type { FileItem } from '../../types'

const formatTime = (value: number): string => {
  if (!Number.isFinite(value)) return '0:00'
  const total = Math.max(0, Math.floor(value))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface VideoPlayerProps {
  src: string
  name: string
  file?: FileItem | null
  onDownload?: (file: FileItem) => void
  onShare?: (file: FileItem) => void
}

interface SeekIndicator {
  side: 'left' | 'right'
  value: number
}

const VideoPlayer = ({ src, name, file, onDownload, onShare }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const volumeRef = useRef(1)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapRef = useRef(0)
  const tapZoneRef = useRef<'left' | 'right' | 'center'>('center')
  const touchHandledRef = useRef(false)
  const lastSeekAtRef = useRef(0)
  const comboSeekAtRef = useRef(0)
  const comboCountRef = useRef(0)
  const comboResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seekIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)
  const [seekIndicator, setSeekIndicator] = useState<SeekIndicator | null>(null)
  const [isInControlsZone, setIsInControlsZone] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null)

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false)
    }, 5000)
  }, [])

  const revealControls = useCallback(
    (forceVisible = false) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
      }
      setShowControls(true)
      if (!forceVisible && !isInControlsZone) {
        scheduleHide()
      }
    },
    [isInControlsZone, scheduleHide]
  )

  useEffect(() => {
    if (!containerRef.current) return
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const handleLoaded = () => {
      setDuration(video.duration || 0)
      if (video.videoWidth && video.videoHeight) {
        setVideoResolution({ width: video.videoWidth, height: video.videoHeight })
      }
    }
    const handleTime = () => setCurrentTime(video.currentTime || 0)
    const handleWaiting = () => setIsBuffering(true)
    const handleLoadStart = () => setIsBuffering(true)
    const handleCanPlay = () => setIsBuffering(false)
    const handlePlaying = () => setIsBuffering(false)
    const handlePlay = () => {
      setIsPlaying(true)
      revealControls()
    }
    const handlePause = () => {
      setIsPlaying(false)
      setShowControls(true)
    }
    video.addEventListener('loadedmetadata', handleLoaded)
    video.addEventListener('timeupdate', handleTime)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.removeEventListener('timeupdate', handleTime)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [revealControls])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
    video.volume = volume
  }, [isMuted, volume])

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current)
      }
      if (comboResetRef.current) {
        clearTimeout(comboResetRef.current)
      }
      if (seekIndicatorTimerRef.current) {
        clearTimeout(seekIndicatorTimerRef.current)
      }
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      await video.play()
    } else {
      video.pause()
    }
  }, [])

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration)) return
      const nextTime = Math.max(0, Math.min(video.duration, video.currentTime + delta))
      video.currentTime = nextTime
      setCurrentTime(nextTime)
      revealControls(true)
    },
    [revealControls]
  )

  const handleSeekBurst = useCallback(
    (direction: number) => {
      const now = Date.now()
      if (now - lastSeekAtRef.current < 140) return
      const inCombo = now - comboSeekAtRef.current < 700
      const nextCount = inCombo ? comboCountRef.current + 1 : 1
      comboCountRef.current = nextCount
      comboSeekAtRef.current = now
      lastSeekAtRef.current = now
      if (comboResetRef.current) {
        clearTimeout(comboResetRef.current)
      }
      comboResetRef.current = setTimeout(() => {
        comboCountRef.current = 0
      }, 850)
      const amount = 5 * nextCount
      seekBy(direction * amount)
      setSeekIndicator({ side: direction < 0 ? 'left' : 'right', value: amount })
      if (seekIndicatorTimerRef.current) {
        clearTimeout(seekIndicatorTimerRef.current)
      }
      seekIndicatorTimerRef.current = setTimeout(() => {
        setSeekIndicator(null)
      }, 600)
    },
    [seekBy]
  )

  const handleSeek = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current
      if (!video) return
      const nextValue = Number(event.target.value)
      if (!Number.isFinite(nextValue) || duration === 0) return
      const nextTime = (nextValue / 1000) * duration
      video.currentTime = nextTime
      setCurrentTime(nextTime)
    },
    [duration]
  )

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false)
      setVolume(volumeRef.current || 1)
      return
    }
    volumeRef.current = volume
    setIsMuted(true)
  }, [isMuted, volume])

  const handleVolume = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value)
    if (!Number.isFinite(nextValue)) return
    setVolume(nextValue)
    if (nextValue === 0) {
      setIsMuted(true)
    } else {
      setIsMuted(false)
      volumeRef.current = nextValue
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
      return
    }
    container.requestFullscreen?.()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement
      if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return
      if (event.key === ' ') {
        event.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay])

  const handlePointerMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const pointerY = event.clientY - rect.top
      const controlsHeight = controlsRef.current?.getBoundingClientRect()?.height ?? 180
      const threshold = Math.max(0, rect.height - controlsHeight - 12)
      const inZone = pointerY >= threshold
      if (inZone) {
        if (!isInControlsZone) setIsInControlsZone(true)
        revealControls(true)
        return
      }
      if (isInControlsZone) setIsInControlsZone(false)
      revealControls()
    },
    [isInControlsZone, revealControls]
  )

  const handleTouch = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      revealControls(true)
      touchHandledRef.current = true
      const touch = event.touches?.[0]
      if (!touch || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      tapZoneRef.current = touch.clientX - rect.left < rect.width / 2 ? 'left' : 'right'
      const now = Date.now()
      const diff = now - lastTapRef.current
      if (diff < 260) {
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current)
          tapTimeoutRef.current = null
        }
        lastTapRef.current = 0
        if (tapZoneRef.current === 'left') {
          handleSeekBurst(-1)
        } else {
          handleSeekBurst(1)
        }
        setShowControls(true)
        return
      }
      lastTapRef.current = now
      tapTimeoutRef.current = setTimeout(() => {
        setShowControls((prev) => !prev)
        tapTimeoutRef.current = null
      }, 240)
    },
    [handleSeekBurst, revealControls]
  )

  const progressValue = duration > 0 ? Math.min(1000, Math.round((currentTime / duration) * 1000)) : 0
  const sizeLabel = file?.size ? formatBytes(file.size) : '-'
  const uploadedAt = file?.uploadedAt || file?.createdAt || file?.updatedAt
  const uploadedLabel = uploadedAt ? new Date(uploadedAt).toLocaleString() : '-'
  const typeLabel = file?.fileType || '-'
  const resolutionLabel = videoResolution ? `${videoResolution.width} x ${videoResolution.height}` : '-'
  const durationLabel = duration ? formatTime(duration) : '-'

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseMove={handlePointerMove}
      onMouseEnter={handlePointerMove}
      onMouseLeave={() => {
        setIsInControlsZone(false)
        scheduleHide()
      }}
      onTouchStart={handleTouch}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        playsInline
        onClick={() => {
          if (touchHandledRef.current) {
            touchHandledRef.current = false
            return
          }
          togglePlay()
        }}
      />
      {seekIndicator && (
        <div
          className={`absolute inset-y-0 ${seekIndicator.side === 'left' ? 'left-0' : 'right-0'} flex items-center`}
        >
          <div className="mx-6 rounded-2xl bg-black/40 px-4 py-2 text-white text-base font-semibold backdrop-blur-sm">
            {seekIndicator.side === 'left' ? '-' : '+'}
            {seekIndicator.value}
          </div>
        </div>
      )}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="h-14 w-14 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        </div>
      )}
      <div
        className={`absolute inset-y-0 right-0 w-80 max-w-[85vw] border-l border-white/10 bg-black/55 backdrop-blur-xl shadow-2xl transition-all duration-300 ease-out flex flex-col ${
          detailsOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="text-sm font-semibold text-white">Detail Video</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!file) return
                onDownload?.(file)
              }}
              className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center"
            >
              <FontAwesomeIcon icon={faFileArrowDown} />
            </button>
            <button
              onClick={() => {
                if (!file) return
                onShare?.(file)
              }}
              className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center"
            >
              <FontAwesomeIcon icon={faShareNodes} />
            </button>
            <button
              onClick={() => setDetailsOpen(false)}
              className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm text-slate-200">
          <div>
            <div className="text-xs text-slate-400 mb-1">Nama</div>
            <div className="font-medium text-white truncate">{name || '-'}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Ukuran</div>
              <div className="font-medium text-white">{sizeLabel}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Resolusi</div>
              <div className="font-medium text-white">{resolutionLabel}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Durasi</div>
              <div className="font-medium text-white">{durationLabel}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Tipe</div>
              <div className="font-medium text-white">{typeLabel}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Diunggah</div>
            <div className="font-medium text-white">{uploadedLabel}</div>
          </div>
        </div>
        <div className="mt-auto px-5 py-4 border-t border-white/10 flex items-center justify-between">
          <button className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center">
            <FontAwesomeIcon icon={faCircleInfo} />
          </button>
          <button className="h-9 w-9 rounded-full bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 transition flex items-center justify-center">
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>
      <div
        ref={controlsRef}
        className={`absolute inset-x-0 bottom-0 px-4 pb-4 pt-20 transition-all ease-out ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
        style={{ transitionDuration: '1200ms' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between text-xs text-slate-100 mb-2">
          <div className="truncate">{name}</div>
        </div>
        <input
          type="range"
          min="0"
          max="1000"
          value={progressValue}
          onChange={handleSeek}
          className="w-full h-1 appearance-none rounded-full bg-white/10 accent-sky-400 focus:outline-none focus:ring-0"
          style={{
            background: `linear-gradient(to right, rgba(56, 189, 248, 0.9) 0%, rgba(56, 189, 248, 0.9) ${progressValue / 10}%, rgba(255, 255, 255, 0.14) ${progressValue / 10}%, rgba(255, 255, 255, 0.14) 100%)`
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-black/35 backdrop-blur-md px-3 py-2 shadow-lg shadow-black/30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSeekBurst(-1)}
              className="h-9 w-9 rounded-full bg-black/35 text-white hover:bg-black/45 transition flex items-center justify-center"
            >
              <FontAwesomeIcon icon={faBackward} />
            </button>
            <button
              onClick={togglePlay}
              className="h-9 w-9 rounded-full bg-black/35 text-white hover:bg-black/45 transition flex items-center justify-center"
            >
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
            <button
              onClick={() => handleSeekBurst(1)}
              className="h-9 w-9 rounded-full bg-black/35 text-white hover:bg-black/45 transition flex items-center justify-center"
            >
              <FontAwesomeIcon icon={faForward} />
            </button>
            <div className="flex items-center gap-3 group/volume">
              <div className="relative flex items-center">
                <button
                  onClick={toggleMute}
                  className="h-9 w-9 rounded-full bg-black/35 text-white hover:bg-black/45 transition flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={isMuted || volume === 0 ? faVolumeXmark : faVolumeHigh} />
                </button>
                <div className="absolute left-11 top-1/2 -translate-y-1/2 -translate-x-2 opacity-0 pointer-events-none transition-all duration-500 ease-out group-hover/volume:opacity-100 group-hover/volume:translate-x-0 group-hover/volume:pointer-events-auto">
                  <div className="flex items-center rounded-full bg-black/40 backdrop-blur-md px-3 py-2 shadow-lg shadow-black/30">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolume}
                      className="w-28 h-1 appearance-none rounded-full bg-white/20 accent-sky-400 focus:outline-none focus:ring-0"
                    />
                  </div>
                </div>
              </div>
              <div className="ml-4 text-slate-200 transition-transform duration-500 ease-out group-hover/volume:translate-x-40">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDetailsOpen((prev) => !prev)}
              className={`h-9 w-9 rounded-full transition flex items-center justify-center ${
                detailsOpen ? 'bg-black/55 text-sky-300' : 'bg-black/35 text-white hover:bg-black/45'
              }`}
            >
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="h-9 w-9 rounded-full bg-black/35 text-white hover:bg-black/45 transition flex items-center justify-center"
            >
              <FontAwesomeIcon icon={faExpand} className={isFullscreen ? 'text-sky-300' : undefined} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
