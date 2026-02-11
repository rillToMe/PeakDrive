import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder } from '@fortawesome/free-solid-svg-icons'
import FolderCard from './FolderCard.jsx'

const FolderList = ({
  folders,
  isMobile,
  selectedFolderId,
  setSelectedFolderId,
  editingFolderId,
  editingName,
  setEditingFolderId,
  setEditingName,
  onRenameFolder,
  onOpenFolder,
  onDownloadFolder,
  onShareFolder,
  onDeleteFolder,
  copiedFolderId,
  onDropUpload,
  selectedItems,
  setSelectedItems
}) => {
  const [menuFolderId, setMenuFolderId] = useState(null)
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (editingFolderId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingFolderId])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'F2') return
      const active = document.activeElement
      if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return
      if (!selectedFolderId || editingFolderId) return
      const folder = folders.find((item) => item.publicId === selectedFolderId)
      if (!folder) return
      event.preventDefault()
      setEditingFolderId(folder.publicId)
      setEditingName(folder.name)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFolderId, editingFolderId, folders, setEditingFolderId, setEditingName])

  useEffect(() => {
    const handleClick = () => setMenuFolderId(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const handleToggleSelect = (folderId) => {
    setSelectedItems((prev) => {
      const isSelected = prev.folders.includes(folderId)
      if (isSelected) {
        return { ...prev, folders: prev.folders.filter((id) => id !== folderId) }
      } else {
        return { ...prev, folders: [...prev.folders, folderId] }
      }
    })
  }

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2 text-lg font-medium text-slate-800 dark:text-slate-100">
          <FontAwesomeIcon icon={faFolder} className="text-amber-500 dark:text-amber-400 text-base" />
          Folders
        </div>
        <div className="text-xs font-medium text-slate-500/80 dark:text-slate-400/80">{folders.length} folder</div>
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {folders.length === 0 && (
          <div className="text-sm text-slate-400 dark:text-slate-400">Belum ada folder.</div>
        )}
        {folders.map((folder) => (
          <FolderCard
            key={folder.publicId}
            folder={folder}
            isMobile={isMobile}
            selected={selectedFolderId === folder.publicId}
            onSelect={() => setSelectedFolderId(folder.publicId)}
            onOpen={() => onOpenFolder(folder)}
            editing={editingFolderId === folder.publicId}
            editingName={editingName}
            onEditingNameChange={setEditingName}
            onRename={onRenameFolder}
            onCancelRename={() => {
              setEditingFolderId(null)
              setEditingName('')
            }}
            inputRef={renameInputRef}
            menuOpen={menuFolderId === folder.publicId}
            onMenuToggle={() =>
              setMenuFolderId((prev) => (prev === folder.publicId ? null : folder.publicId))
            }
            onDownload={() => {
              onDownloadFolder(folder)
              setMenuFolderId(null)
            }}
            onShare={() => {
              onShareFolder(folder.publicId)
              setMenuFolderId(null)
            }}
            onDelete={() => {
              onDeleteFolder(folder)
              setMenuFolderId(null)
            }}
            copied={copiedFolderId === folder.publicId}
            onDropUpload={(entries, supportsFolders) =>
              onDropUpload(folder, entries, supportsFolders)
            }
            multiSelected={selectedItems.folders.includes(folder.publicId)}
            onToggleSelect={() => handleToggleSelect(folder.publicId)}
            selectionMode={selectedItems.files.length > 0 || selectedItems.folders.length > 0}
          />
        ))}
      </div>
    </section>
  )
}

export default FolderList
