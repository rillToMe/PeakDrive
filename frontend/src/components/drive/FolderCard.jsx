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
      className={`relative text-left p-3 pr-10 rounded-xl border bg-white hover:bg-slate-50 transition shadow-sm ${
        selected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'
      }`}
    >
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
      <div className="flex items-center gap-2 text-slate-800">
        <FontAwesomeIcon icon={faFolder} className="text-slate-400" />
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
            className="w-full border-0 bg-transparent p-0 text-sm font-medium outline-none"
          />
        ) : (
          <span className="font-medium truncate">{folder.name}</span>
        )}
      </div>
      <div className="text-xs text-slate-400 mt-1">Klik untuk buka</div>
    </div>
  )
}

export default FolderCard
