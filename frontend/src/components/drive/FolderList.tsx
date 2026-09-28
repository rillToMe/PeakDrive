import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder } from '@fortawesome/free-solid-svg-icons'
import FolderCard from './FolderCard'
import type { DroppedEntry, FolderItem, SelectedItems } from '../../types'
import type { Dispatch, SetStateAction } from 'react'

interface FolderListProps {
  folders: FolderItem[]
  isMobile?: boolean
  selectedFolderId: string | null
  setSelectedFolderId: (id: string | null) => void
  editingFolderId: string | null
  editingName: string
  setEditingFolderId: (id: string | null) => void
  setEditingName: (name: string) => void
  onRenameFolder: (folderId: string, name: string) => void
  onOpenFolder: (folder: FolderItem) => void
  onDownloadFolder: (folder: FolderItem) => void
  onShareFolder: (folder: FolderItem) => void
  onDetailFolder: (folder: FolderItem) => void
  onDeleteFolder: (folder: FolderItem) => void
  onDropUpload?: (folder: FolderItem, entries: DroppedEntry[], supportsFolders: boolean) => void
  selectedItems: SelectedItems
  setSelectedItems: Dispatch<SetStateAction<SelectedItems>>
}

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
  onDetailFolder,
  onDeleteFolder,
  onDropUpload,
  selectedItems,
  setSelectedItems
}: FolderListProps) => {
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editingFolderId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingFolderId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

  const handleToggleSelect = (folderId: string) => {
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
            onStartRename={() => {
              setEditingFolderId(folder.publicId)
              setEditingName(folder.name)
              setMenuFolderId(null)
            }}
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
              onShareFolder(folder)
              setMenuFolderId(null)
            }}
            onDetail={() => {
              onDetailFolder(folder)
              setMenuFolderId(null)
            }}
            onDelete={() => {
              onDeleteFolder(folder)
              setMenuFolderId(null)
            }}
            onDropUpload={(entries, supportsFolders) =>
              onDropUpload?.(folder, entries, supportsFolders)
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
