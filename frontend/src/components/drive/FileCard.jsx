import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faCube,
  faFileArrowDown,
  faFileLines,
  faFilm,
  faImage,
  faShareNodes,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import ModelViewer from '../ModelViewer.jsx'
import { formatBytes, getModelExtension, isModel } from '../../services/driveUtils.js'
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
  copied,
  multiSelected,
  onToggleSelect,
  selectionMode
}) => {
  const name = file.filename || file.originalName || file.name || ''
  const modelExtension = getModelExtension(name)
  const isLargeModel = isModel(name) && file.size > MODEL_PREVIEW_LIMIT_MB * 1024 * 1024
  const disableModelPreview = isMobile || isLargeModel

  return (
    <div
      onClick={(e) => {
        if (selectionMode) {
          e.stopPropagation()
          onToggleSelect()
          return
        }
        onOpen()
      }}
      className={`group relative rounded-2xl border transition cursor-pointer overflow-visible hover:-translate-y-0.5 ${
        multiSelected
          ? 'border-indigo-400 ring-2 ring-indigo-200 bg-white shadow-md dark:border-sky-500 dark:ring-sky-700/40 dark:bg-slate-800/60'
          : 'border-slate-200/60 bg-white shadow-sm hover:shadow-md dark:border-slate-800/60 dark:bg-slate-800/40'
      }`}
    >
      <div
        className={`absolute left-2.5 top-2.5 z-10 flex items-center justify-center h-5 w-5 rounded border transition-all duration-200 ${
          multiSelected
            ? 'bg-indigo-500 border-indigo-500 text-white scale-110'
            : selectionMode
            ? 'bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600 scale-100'
            : 'bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600 opacity-0 group-hover:opacity-100 scale-90'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect()
        }}
      >
        {multiSelected && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div className="h-28 w-full bg-slate-50 flex items-center justify-center overflow-hidden rounded-t-2xl dark:bg-slate-900/50">
        {file.fileType?.startsWith('image/') && previews[file.publicId]?.url && (
          <img
            src={previews[file.publicId]?.url}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        {file.fileType?.startsWith('video/') && previews[file.publicId]?.url && (
          <video
            src={previews[file.publicId]?.url}
            className="h-full w-full object-cover bg-black"
            muted
            playsInline
          />
        )}
        {isModel(name) && previews[file.publicId]?.url && !disableModelPreview && (
          <ModelViewer url={previews[file.publicId]?.url} format={modelExtension} containerClassName="h-full" />
        )}
        {((isModel(name) && disableModelPreview) ||
          (!file.fileType?.startsWith('image/') && !file.fileType?.startsWith('video/') && !isModel(name))) && (
          <div className="flex flex-col items-center justify-center text-xs text-slate-400 gap-1 dark:text-slate-400">
            <FontAwesomeIcon icon={isModel(name) ? faCube : faFileLines} className="text-lg" />
            {isModel(name) ? 'Preview 3D nonaktif' : 'Preview tidak tersedia'}
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-slate-800 truncate dark:text-slate-100 leading-snug">{name}</div>
          <ActionMenu
            open={menuOpen}
            onToggle={onMenuToggle}
            containerClassName="relative"
            buttonClassName="h-7 w-7 shadow-none border-slate-200/70 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
            menuClassName="right-0 top-full mt-2 z-30"
            items={[
              {
                label: 'Download',
                icon: faFileArrowDown,
                tone: 'text-slate-700 dark:text-slate-200',
                onClick: onDownload
              },
              {
                label: copied ? 'Tersalin' : 'Share',
                icon: copied ? faCheck : faShareNodes,
                iconClassName: copied ? 'animate-pulse' : '',
                tone: copied ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-200',
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
        </div>
        <div className="flex items-center gap-2 text-xs font-normal text-slate-500/80 dark:text-slate-400/80">
          {file.fileType?.startsWith('image/') && <FontAwesomeIcon icon={faImage} className="text-[10px]" />}
          {file.fileType?.startsWith('video/') && <FontAwesomeIcon icon={faFilm} className="text-[10px]" />}
          {isModel(name) && <FontAwesomeIcon icon={faCube} className="text-[10px]" />}
          {!file.fileType?.startsWith('image/') && !file.fileType?.startsWith('video/') && !isModel(name) && (
            <FontAwesomeIcon icon={faFileLines} className="text-[10px]" />
          )}
          {modelExtension && <span className="uppercase text-[9px] font-semibold tracking-wider">{modelExtension}</span>}
          <span className="tabular-nums">{formatBytes(file.size)}</span>
        </div>
      </div>
    </div>
  )
}

export default FileCard
