import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCube, faFileLines, faXmark } from '@fortawesome/free-solid-svg-icons'
import ImageViewerModal from './modals/ImageViewerModal'
import ModelPreviewModal from './modals/ModelPreviewModal'
import VideoPlayerModal from './modals/VideoPlayerModal'
import type { FileItem, PreviewMap } from '../types'

const MODEL_PREVIEW_LIMIT_MB = 200

interface PreviewModalProps {
  open: boolean
  file: FileItem | null
  previews: PreviewMap
  isModel: (filename: string) => boolean
  onClose: () => void
  onDownload?: (file: FileItem) => void
  onShare?: (file: FileItem) => void
  onDelete?: (file: FileItem) => void
  openAt: number
}

const PreviewModal = ({
  open,
  file,
  previews,
  isModel,
  onClose,
  onDownload,
  onShare,
  onDelete,
  openAt
}: PreviewModalProps) => {
  if (!open || !file) return null
  const preview = previews[file.publicId]
  const name = file.filename || file.originalName || file.name || ''
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const isLargeModel = isModel(name) && (file.size ?? 0) > MODEL_PREVIEW_LIMIT_MB * 1024 * 1024
  const disableModelPreview = isMobile || isLargeModel
  if (file.fileType?.startsWith('image/') && preview?.url) {
    return (
      <ImageViewerModal
        open={open}
        name={name}
        src={preview.url}
        file={file}
        onClose={onClose}
        onDownload={onDownload}
        onDelete={onDelete}
        openAt={openAt}
      />
    )
  }
  if (file.fileType?.startsWith('video/') && preview?.url) {
    return (
      <VideoPlayerModal
        open={open}
        name={name}
        src={preview.url}
        file={file}
        onClose={onClose}
        onDownload={onDownload}
        onShare={onShare}
        openAt={openAt}
      />
    )
  }
  if (isModel(name) && !disableModelPreview) {
    return (
      <ModelPreviewModal
        open={open}
        file={file}
        onClose={onClose}
        openAt={openAt}
        disabled={disableModelPreview}
      />
    )
  }
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
      onClick={() => {
        if (Date.now() - openAt < 300) return
        onClose()
      }}
    >
      <div
        className="relative w-[95vw] max-w-6xl max-h-[90vh] overflow-auto bg-white rounded-2xl p-6 dark:bg-[#202225]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-10 w-10 rounded-full border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <div className="mb-4">
          <div className="text-lg font-semibold text-slate-900 truncate dark:text-slate-100">{name}</div>
        </div>
        <div className="space-y-4">
          {isModel(name) && disableModelPreview && (
            <div className="h-64 w-full rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-500 gap-2 dark:bg-[#1F2023] dark:border-slate-700 dark:text-slate-400">
              <FontAwesomeIcon icon={faCube} />
              Preview 3D dinonaktifkan
            </div>
          )}
          {!file.fileType?.startsWith('image/') && !file.fileType?.startsWith('video/') && !isModel(name) && (
            <div className="h-64 w-full rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-500 gap-2 dark:bg-[#1F2023] dark:border-slate-700 dark:text-slate-400">
              <FontAwesomeIcon icon={faFileLines} />
              Preview tidak tersedia
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PreviewModal
