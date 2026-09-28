import { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import VideoPlayer from '../ui/VideoPlayer'
import type { FileItem } from '../../types'

interface VideoPlayerModalProps {
  open: boolean
  name: string
  src: string
  file?: FileItem | null
  onClose: () => void
  onDownload?: (file: FileItem) => void
  onShare?: (file: FileItem) => void
  openAt: number
}

const VideoPlayerModal = ({ open, name, src, file, onClose, onDownload, onShare, openAt }: VideoPlayerModalProps) => {
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={() => {
        if (Date.now() - openAt < 300) return
        onClose()
      }}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1F2023] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="text-[0.95rem] font-semibold text-slate-900 truncate dark:text-slate-100">{name}</div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div className="flex-1 min-h-0 bg-black">
          <VideoPlayer src={src} name={name} file={file} onDownload={onDownload} onShare={onShare} />
        </div>
      </div>
    </div>
  )
}

export default VideoPlayerModal
