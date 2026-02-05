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
      className="relative rounded-2xl border border-sky-200/70 bg-white shadow-sm hover:shadow-md transition cursor-pointer overflow-visible hover:-translate-y-0.5 dark:border-slate-700 dark:bg-[#202225]"
    >
      <div className="h-28 w-full bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center overflow-hidden rounded-t-2xl dark:from-[#1F2023] dark:to-[#1F2023]">
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
          <div className="text-sm font-medium text-slate-800 truncate dark:text-slate-100">{name}</div>
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
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {file.fileType?.startsWith('image/') && <FontAwesomeIcon icon={faImage} />}
          {file.fileType?.startsWith('video/') && <FontAwesomeIcon icon={faFilm} />}
          {isModel(name) && <FontAwesomeIcon icon={faCube} />}
          {!file.fileType?.startsWith('image/') && !file.fileType?.startsWith('video/') && !isModel(name) && (
            <FontAwesomeIcon icon={faFileLines} />
          )}
          {modelExtension && <span className="uppercase text-[10px]">{modelExtension}</span>}
          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>
    </div>
  )
}

export default FileCard
