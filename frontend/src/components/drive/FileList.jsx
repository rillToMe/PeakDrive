import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileLines } from '@fortawesome/free-solid-svg-icons'
import FileCard from './FileCard.jsx'

const FILES_CHUNK_SIZE = 18

const FileList = ({
  files,
  previews,
  isMobile,
  onOpenFile,
  onDownload,
  onShare,
  onDelete,
  onVisibleFilesChange,
  copiedFileId,
  selectedItems,
  setSelectedItems
}) => {
  const [filesChunk, setFilesChunk] = useState(1)
  const [menuFileId, setMenuFileId] = useState(null)
  const loadMoreRef = useRef(null)

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

  const handleToggleSelect = (fileId) => {
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
            isMobile={isMobile}
            onOpen={() => onOpenFile(file)}
            onDownload={() => {
              onDownload(file)
              setMenuFileId(null)
            }}
            onShare={() => {
              onShare(file.publicId)
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
            copied={copiedFileId === file.publicId}
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
