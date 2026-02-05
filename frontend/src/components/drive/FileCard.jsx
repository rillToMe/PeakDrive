import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faCube,
  faEye,
  faFileArrowDown,
  faFileLines,
  faFilm,
  faImage,
  faShareNodes,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import ModelViewer from '../ModelViewer.jsx'
import { getModelExtension, isModel } from '../../services/driveUtils.js'
import ActionMenu from './ActionMenu.jsx'

const MODEL_PREVIEW_LIMIT_MB = 200

const FileCard = ({
  file,
  previews,
  isMobile,
  onOpen,
  onDownload,
  onShare,
  onDelete,
  menuOpen,
  onMenuToggle,
  copied
}) => {
  const name = file.filename || file.originalName || file.name || ''
  const modelExtension = getModelExtension(name)
  const isLargeModel = isModel(name) && file.size > MODEL_PREVIEW_LIMIT_MB * 1024 * 1024
  const disableModelPreview = isMobile || isLargeModel

  return (
    <div
      onClick={onOpen}
      className="relative p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-sm hover:shadow-md transition cursor-pointer"
    >
      <button
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
        className="absolute top-3 right-12 h-9 w-9 rounded-full bg-white border border-slate-200 p-0 text-slate-500 hover:text-slate-800 flex items-center justify-center shadow-sm"
      >
        <FontAwesomeIcon icon={faEye} />
      </button>
      <ActionMenu
        open={menuOpen}
        onToggle={onMenuToggle}
        items={[
          {
            label: 'Download',
            icon: faFileArrowDown,
            tone: 'text-slate-700',
            onClick: onDownload
          },
          {
            label: copied ? 'Tersalin' : 'Share',
            icon: copied ? faCheck : faShareNodes,
            iconClassName: copied ? 'animate-pulse' : '',
            tone: copied ? 'text-emerald-600' : 'text-slate-700',
            onClick: onShare
          },
          {
            label: 'Delete',
            icon: faTrash,
            tone: 'text-red-600',
            onClick: onDelete
          }
        ]}
      />
      <div className="pr-20 space-y-1">
        <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
      </div>
      {file.fileType?.startsWith('image/') && previews[file.publicId]?.url && (
        <img
          src={previews[file.publicId]?.url}
          alt={name}
          className="h-40 w-full object-cover rounded-lg"
          loading="lazy"
        />
      )}
      {file.fileType?.startsWith('video/') && previews[file.publicId]?.url && (
        <video
          src={previews[file.publicId]?.url}
          className="h-40 w-full rounded-lg bg-black"
          controls
          preload="metadata"
        />
      )}
      {isModel(name) && previews[file.publicId]?.url && !disableModelPreview && (
        <ModelViewer url={previews[file.publicId]?.url} format={modelExtension} />
      )}
      {isModel(name) && disableModelPreview && (
        <div className="h-40 w-full rounded-lg bg-white border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-400 gap-2">
          <FontAwesomeIcon icon={faCube} className="text-lg" />
          Preview 3D dinonaktifkan
        </div>
      )}
      {!file.fileType?.startsWith('image/') && !file.fileType?.startsWith('video/') && !isModel(name) && (
        <div className="h-40 w-full rounded-lg bg-white border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-400 gap-2">
          <FontAwesomeIcon icon={faFileLines} className="text-lg" />
          Preview tidak tersedia
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          {file.fileType?.startsWith('image/') && <FontAwesomeIcon icon={faImage} />}
          {file.fileType?.startsWith('video/') && <FontAwesomeIcon icon={faFilm} />}
          {isModel(name) && <FontAwesomeIcon icon={faCube} />}
          {!file.fileType?.startsWith('image/') && !file.fileType?.startsWith('video/') && !isModel(name) && (
            <FontAwesomeIcon icon={faFileLines} />
          )}
          {modelExtension && (
            <span className="text-[10px] uppercase text-slate-500 bg-white/80 rounded-md px-1.5 py-0.5">
              {modelExtension}
            </span>
          )}
          <span className="text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>
    </div>
  )
}

export default FileCard
