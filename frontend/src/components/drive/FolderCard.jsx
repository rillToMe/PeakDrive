import { useState } from 'react'
import readDroppedEntries from '../../utils/readDroppedEntries.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faFolder, faFileArrowDown, faShareNodes, faTrash } from '@fortawesome/free-solid-svg-icons'
import ActionMenu from './ActionMenu.jsx'

const FolderCard = ({
  folder,
  selected,
  onSelect,
  onOpen,
  editing,
  editingName,
  onEditingNameChange,
  onRename,
  onCancelRename,
  menuOpen,
  onMenuToggle,
  onDownload,
  onShare,
  onDelete,
  copied,
  inputRef,
  onDropUpload,
  isMobile,
  multiSelected,
  onToggleSelect,
  selectionMode
}) => {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      onClick={(e) => {
        if (editing) return
        if (selectionMode) {
          e.stopPropagation()
          onToggleSelect()
          return
        }
        onSelect()
        if (isMobile) {
          onOpen()
        }
      }}
      onDoubleClick={() => {
        if (editing) return
        if (selectionMode) return
        if (isMobile) return
        onSelect()
        onOpen()
      }}
      onDragOver={(event) => {
        if (!onDropUpload) return
        event.preventDefault()
        event.stopPropagation()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!onDropUpload) return
        event.preventDefault()
        event.stopPropagation()
        setDragging(false)
      }}
      onDrop={async (event) => {
        if (!onDropUpload) return
        event.preventDefault()
        event.stopPropagation()
        setDragging(false)
        const { entries, supportsFolders } = await readDroppedEntries(event.dataTransfer)
        if (entries.length === 0) {
          if (!supportsFolders) {
            onDropUpload(folder, [], supportsFolders)
          }
          return
        }
        onDropUpload(folder, entries, supportsFolders)
      }}
      className={`group relative text-left h-12 flex items-center gap-2 px-3 pr-10 rounded-xl border bg-white shadow-sm hover:shadow transition dark:bg-slate-800/40 dark:hover:bg-slate-800/60 ${
        dragging
          ? 'border-sky-400 ring-2 ring-sky-200 dark:border-sky-500 dark:ring-sky-700/40'
          : multiSelected
          ? 'border-indigo-400 ring-2 ring-indigo-200 dark:border-sky-500 dark:ring-sky-700/40'
          : selected
          ? 'border-indigo-400/50 dark:border-sky-500/50'
          : 'border-slate-200/60 dark:border-slate-800/60'
      }`}
    >
      <div
        className={`absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-5 w-5 rounded border transition-all duration-200 ${
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
      <ActionMenu
        open={menuOpen}
        onToggle={onMenuToggle}
        containerClassName="absolute top-2 right-2"
        menuClassName="right-0"
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
      <div className={`flex items-center gap-2 text-slate-800 w-full min-w-0 dark:text-slate-100 transition-all duration-200 ${multiSelected || selectionMode ? 'ml-7' : 'ml-0'}`}>
        <FontAwesomeIcon
          icon={faFolder}
          className={`text-sm transition-all duration-200 ${
            multiSelected || selectionMode ? 'opacity-0 scale-0' : 'opacity-100 scale-100'
          } text-amber-500 dark:text-amber-300`}
        />
        {editing ? (
          <input
            ref={inputRef}
            value={editingName}
            onChange={(event) => onEditingNameChange(event.target.value)}
            onBlur={() => onRename(folder.publicId, editingName)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onRename(folder.publicId, editingName)
              }
              if (event.key === 'Escape') {
                onCancelRename()
              }
            }}
            className="w-full border-0 bg-transparent p-0 text-sm font-medium outline-none text-slate-900 dark:text-slate-100 leading-none"
          />
        ) : (
          <span className="font-medium truncate text-sm leading-none">{folder.name}</span>
        )}
      </div>
    </div>
  )
}

export default FolderCard
