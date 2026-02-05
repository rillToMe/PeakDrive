import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder } from '@fortawesome/free-solid-svg-icons'
import FolderCard from './FolderCard.jsx'

const FolderList = ({
  folders,
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
  copiedFolderId
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

  return (
    <section className="bg-gradient-to-br from-amber-50/60 via-white to-white border border-amber-100/70 rounded-2xl p-4 md:p-5 shadow-sm dark:from-[#202225] dark:via-[#202225] dark:to-[#202225] dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
          <FontAwesomeIcon icon={faFolder} className="text-amber-500 dark:text-amber-300" />
          Folders
        </div>
        <div className="text-xs text-amber-500 dark:text-amber-200">{folders.length} folder</div>
      </div>
      <div className="flex flex-wrap gap-3">
        {folders.length === 0 && (
          <div className="text-sm text-slate-400 dark:text-slate-400">Belum ada folder.</div>
        )}
        {folders.map((folder) => (
          <div key={folder.publicId} className="relative w-full sm:w-[48%] md:w-[31%] lg:w-[23%]">
            <FolderCard
              folder={folder}
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
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export default FolderList
