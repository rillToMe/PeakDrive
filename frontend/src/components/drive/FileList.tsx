import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileLines } from '@fortawesome/free-solid-svg-icons'
import FileCard from './FileCard'
import type { FileItem, PreviewMap, SelectedItems } from '../../types'
import type { Dispatch, SetStateAction } from 'react'

const FILES_CHUNK_SIZE = 18

interface FileListProps {
  files: FileItem[]
  previews: PreviewMap
  onOpenFile: (file: FileItem) => void
  onDownload: (file: FileItem) => void
  onRenameFile: (fileId: string, name: string) => Promise<boolean> | void
  onShare: (file: FileItem) => void
  onDetail: (file: FileItem) => void
  onDelete: (file: FileItem) => void
  onVisibleFilesChange: (files: FileItem[]) => void
  selectedItems: SelectedItems
  setSelectedItems: Dispatch<SetStateAction<SelectedItems>>
}

const FileList = ({
  files,
  previews,
  onOpenFile,
  onDownload,
  onRenameFile,
  onShare,
  onDetail,
  onDelete,
  onVisibleFilesChange,
  selectedItems,
  setSelectedItems
}: FileListProps) => {
  const [filesChunk, setFilesChunk] = useState(1)
  const [menuFileId, setMenuFileId] = useState<string | null>(null)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const maxChunks = useMemo(() => Math.max(1, Math.ceil(files.length / FILES_CHUNK_SIZE)), [files.length])
  const safeChunk = Math.min(filesChunk, maxChunks)
  const visibleFiles = useMemo(() => files.slice(0, safeChunk * FILES_CHUNK_SIZE), [files, safeChunk])

  useEffect(() => {
    onVisibleFilesChange(visibleFiles)
  }, [visibleFiles, onVisibleFilesChange])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node) return
    if (files.length <= visibleFiles.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setFilesChunk((prev) => Math.min(prev + 1, maxChunks))
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [files.length, visibleFiles.length, maxChunks])

  useEffect(() => {
    const handleClick = () => setMenuFileId(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    if (editingFileId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingFileId])

  const handleToggleSelect = (fileId: string) => {
    setSelectedItems((prev) => {
      const isSelected = prev.files.includes(fileId)
      if (isSelected) {
        return { ...prev, files: prev.files.filter((id) => id !== fileId) }
      } else {
        return { ...prev, files: [...prev.files, fileId] }
      }
    })
  }

  const selectionMode = selectedItems.files.length > 0 || selectedItems.folders.length > 0

  const getFileNameParts = (value: string) => {
    const safe = value || ''
    const lastDot = safe.lastIndexOf('.')
    if (lastDot <= 0) {
      return { base: safe, ext: '' }
    }
    return { base: safe.slice(0, lastDot), ext: safe.slice(lastDot) }
  }

  const handleStartRename = (file: FileItem) => {
    const currentName = file.filename || file.originalName || file.name || ''
    const { base } = getFileNameParts(currentName)
    setEditingFileId(file.publicId)
    setEditingName(base)
    setMenuFileId(null)
  }

  const handleSubmitRename = async (fileId: string, nextName: string) => {
    await onRenameFile(fileId, nextName)
    setEditingFileId(null)
    setEditingName('')
  }

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2 text-lg font-medium text-slate-800 dark:text-slate-100">
          <FontAwesomeIcon icon={faFileLines} className="text-sky-500 dark:text-sky-400 text-base" />
          Files
        </div>
        <div className="text-xs font-medium text-slate-500/80 dark:text-slate-400/80">{files.length} file</div>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {files.length === 0 && (
          <div className="text-sm text-slate-400 dark:text-slate-400">Belum ada file.</div>
        )}
        {visibleFiles.map((file) => (
          <FileCard
            key={file.publicId}
            file={file}
            previews={previews}
            onOpen={() => onOpenFile(file)}
            onDownload={() => {
              onDownload(file)
              setMenuFileId(null)
            }}
            onShare={() => {
              onShare(file)
              setMenuFileId(null)
            }}
            onStartRename={() => handleStartRename(file)}
            editing={editingFileId === file.publicId}
            editingName={editingName}
            onEditingNameChange={setEditingName}
            onSubmitRename={handleSubmitRename}
            onCancelRename={() => {
              setEditingFileId(null)
              setEditingName('')
            }}
            inputRef={renameInputRef}
            onDetail={() => {
              onDetail(file)
              setMenuFileId(null)
            }}
            onDelete={() => {
              onDelete(file)
              setMenuFileId(null)
            }}
            menuOpen={menuFileId === file.publicId}
            onMenuToggle={() =>
              setMenuFileId((prev) => (prev === file.publicId ? null : file.publicId))
            }
            multiSelected={selectedItems.files.includes(file.publicId)}
            onToggleSelect={() => handleToggleSelect(file.publicId)}
            selectionMode={selectionMode}
          />
        ))}
      </div>
      {files.length > visibleFiles.length && <div ref={loadMoreRef} className="mt-4 h-6" />}
    </section>
  )
}

export default FileList
