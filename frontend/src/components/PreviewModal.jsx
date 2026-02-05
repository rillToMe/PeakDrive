import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCube, faFileLines, faXmark } from '@fortawesome/free-solid-svg-icons'
import ModelViewer from './ModelViewer.jsx'

const MODEL_PREVIEW_LIMIT_MB = 200

const PreviewModal = ({ open, file, previews, isModel, onClose, openAt }) => {
  if (!open || !file) return null
  const preview = previews[file.publicId]
  const name = file.filename || file.originalName || file.name || ''
  const lowerName = name.toLowerCase()
  const modelExtension = lowerName.endsWith('.glb')
    ? 'glb'
    : lowerName.endsWith('.gltf')
      ? 'gltf'
      : lowerName.endsWith('.fbx')
        ? 'fbx'
        : ''
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const isLargeModel = isModel(name) && file.size > MODEL_PREVIEW_LIMIT_MB * 1024 * 1024
  const disableModelPreview = isMobile || isLargeModel
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={() => {
        if (Date.now() - openAt < 300) return
        onClose()
      }}
    >
      <div
        className="relative w-[95vw] max-w-6xl max-h-[90vh] overflow-auto bg-white rounded-2xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-10 w-10 rounded-full border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <div className="mb-4">
          <div className="text-lg font-semibold text-slate-900 truncate">{name}</div>
        </div>
        <div className="space-y-4">
          {file.fileType?.startsWith('image/') && preview?.url && (
            <img src={preview.url} alt={name} className="w-full max-h-[75vh] object-contain rounded-xl" loading="lazy" />
          )}
          {file.fileType?.startsWith('video/') && preview?.url && (
            <video src={preview.url} className="w-full rounded-xl bg-black" controls />
          )}
          {isModel(name) && preview?.url && !disableModelPreview && (
            <ModelViewer url={preview.url} format={modelExtension} containerClassName="h-[65vh]" />
          )}
          {isModel(name) && disableModelPreview && (
            <div className="h-64 w-full rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-500 gap-2">
              <FontAwesomeIcon icon={faCube} />
              Preview 3D dinonaktifkan
            </div>
          )}
          {!file.fileType?.startsWith('image/') && !file.fileType?.startsWith('video/') && !isModel(name) && (
              <div className="h-64 w-full rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-500 gap-2">
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
