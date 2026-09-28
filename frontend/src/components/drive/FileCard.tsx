import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faCube,
  faFileArrowDown,
  faFileLines,
  faFilm,
  faImage,
  faPen,
  faCircleInfo,
  faShareNodes,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import { formatBytes, getModelExtension, isModel } from '../../services/driveUtils'
import ActionMenu from './ActionMenu'
import type { ActionMenuItem } from './ActionMenu'
import type { FileItem, PreviewMap } from '../../types'

interface FileCardProps {
  file: FileItem
  previews: PreviewMap
  onOpen: () => void
  onDownload: () => void
  onStartRename?: () => void
  onShare?: () => void
  onDetail?: () => void
  onDelete?: () => void
  menuOpen: boolean
  onMenuToggle: () => void
  copied?: boolean
  editing?: boolean
  editingName?: string
  onEditingNameChange?: (value: string) => void
  onSubmitRename?: (fileId: string, name: string) => void
  onCancelRename?: () => void
  inputRef?: RefObject<HTMLInputElement | null> | null
  multiSelected?: boolean
  onToggleSelect?: () => void
  selectionMode?: boolean
  isMobile?: boolean
  statusLabel?: string
  disabled?: boolean
  menuItems?: ActionMenuItem[]
}

const FileCard = ({
  file,
  previews,
  onOpen,
  onDownload,
  onStartRename,
  onShare,
  onDetail,
  onDelete,
  menuOpen,
  onMenuToggle,
  copied,
  editing = false,
  editingName = '',
  onEditingNameChange,
  onSubmitRename,
  onCancelRename,
  inputRef,
  multiSelected,
  onToggleSelect,
  selectionMode,
  statusLabel,
  disabled = false,
  menuItems
}: FileCardProps) => {
  const name = file.filename || file.originalName || file.name || ''
  const modelExtension = getModelExtension(name)
  const lastDot = name.lastIndexOf('.')
  const fileExtension = lastDot > 0 ? name.slice(lastDot) : ''
  const buildNextName = () => {
    const base = (editingName || '').trim()
    return base ? `${base}${fileExtension}` : ''
  }

  const defaultMenuItems: ActionMenuItem[] = [
    {
      label: 'Download',
      icon: faFileArrowDown,
      tone: 'text-slate-700 dark:text-slate-200',
      onClick: onDownload
    },
    {
      label: 'Rename',
      icon: faPen,
      tone: 'text-slate-700 dark:text-slate-200',
      onClick: onStartRename
    },
    {
      label: copied ? 'Tersalin' : 'Share',
      icon: copied ? faCheck : faShareNodes,
      iconClassName: copied ? 'animate-pulse' : '',
      tone: copied ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-200',
      onClick: onShare
    },
    {
      label: 'Detail',
      icon: faCircleInfo,
      tone: 'text-slate-700 dark:text-slate-200',
      onClick: onDetail
    },
    {
      label: 'Delete',
      icon: faTrash,
      tone: 'text-red-600',
      onClick: onDelete
    }
  ]

  return (
    <div
      onClick={(e: ReactMouseEvent<HTMLDivElement>) => {
        if (editing || disabled) return
        if (selectionMode) {
          e.stopPropagation()
          onToggleSelect?.()
          return
        }
        onOpen()
      }}
      className={`group relative rounded-2xl border transition cursor-pointer overflow-visible hover:-translate-y-0.5 ${
        multiSelected
          ? 'border-indigo-400 ring-2 ring-indigo-200 bg-white shadow-md dark:border-sky-500 dark:ring-sky-700/40 dark:bg-slate-800/60'
          : 'border-slate-200/60 bg-white shadow-sm hover:shadow-md dark:border-slate-800/60 dark:bg-slate-800/40'
      } ${menuOpen ? 'z-40' : 'z-0'} ${disabled ? 'opacity-60' : ''}`}
    >
      <div
        className={`absolute left-2.5 top-2.5 z-10 flex items-center justify-center h-5 w-5 rounded border transition-all duration-200 ${
          multiSelected
            ? 'bg-indigo-500 border-indigo-500 text-white scale-110'
            : selectionMode
            ? 'bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600 scale-100'
            : 'bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600 opacity-0 group-hover:opacity-100 scale-90'
        }`}
        onClick={(e: ReactMouseEvent<HTMLDivElement>) => {
          e.stopPropagation()
          onToggleSelect?.()
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
        {isModel(name) && previews[file.publicId]?.url && (
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
        {(!file.fileType?.startsWith('image/') && !file.fileType?.startsWith('video/') && !previews[file.publicId]?.url) && (
          <div className="flex flex-col items-center justify-center text-xs text-slate-400 gap-1 dark:text-slate-400">
            <FontAwesomeIcon icon={isModel(name) ? faCube : faFileLines} className="text-lg" />
            {isModel(name) ? 'Preview 3D tersedia di modal' : 'Preview tidak tersedia'}
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-slate-800 truncate dark:text-slate-100 leading-snug w-full min-w-0">
            {editing ? (
              <div className="flex items-center w-full min-w-0">
                <input
                  ref={inputRef}
                  value={editingName}
                  onChange={(event) => onEditingNameChange?.(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={() => onSubmitRename?.(file.publicId, buildNextName())}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                    if (event.key === 'Enter') {
                      onSubmitRename?.(file.publicId, buildNextName())
                    }
                    if (event.key === 'Escape') {
                      onCancelRename?.()
                    }
                  }}
                  className="min-w-0 w-full border-0 bg-transparent p-0 text-sm font-medium outline-none text-slate-900 dark:text-slate-100 leading-snug"
                />
                {fileExtension && (
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-snug">
                    {fileExtension}
                  </span>
                )}
              </div>
            ) : (
              name
            )}
          </div>
          <ActionMenu
            open={menuOpen}
            onToggle={onMenuToggle}
            containerClassName={`relative ${menuOpen ? 'z-50' : 'z-10'}`}
            buttonClassName="h-7 w-7 shadow-none border-slate-200/70 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
            menuClassName="right-0 z-50"
            items={menuItems ?? defaultMenuItems}
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
          {statusLabel && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">{statusLabel}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileCard
