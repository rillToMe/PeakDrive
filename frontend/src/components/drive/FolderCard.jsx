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
  inputRef
}) => {
  return (
    <div
      onClick={() => {
        if (editing) return
        onSelect()
      }}
      onDoubleClick={() => {
        if (editing) return
        onSelect()
        onOpen()
      }}
      className={`relative text-left h-12 flex items-center gap-2 px-3 pr-10 rounded-xl border bg-amber-50/70 hover:bg-amber-100/60 transition dark:bg-[#1F2023] dark:hover:bg-[#26282c] ${
        selected
          ? 'border-indigo-400 ring-2 ring-indigo-200 dark:border-sky-500 dark:ring-sky-700/40'
          : 'border-amber-200/70 dark:border-slate-700'
      }`}
    >
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
      <div className="flex items-center gap-2 text-slate-800 w-full min-w-0 dark:text-slate-100">
        <FontAwesomeIcon icon={faFolder} className="text-amber-500 dark:text-amber-300" />
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
            className="w-full border-0 bg-transparent p-0 text-sm font-medium outline-none text-slate-900 dark:text-slate-100"
          />
        ) : (
          <span className="font-medium truncate text-sm">{folder.name}</span>
        )}
      </div>
    </div>
  )
}

export default FolderCard
