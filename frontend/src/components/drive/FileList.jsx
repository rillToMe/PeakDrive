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
  copiedFileId
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

  return (
    <section className="bg-gradient-to-br from-sky-50/60 via-white to-white border border-sky-100/70 rounded-2xl p-4 md:p-5 shadow-sm dark:from-[#202225] dark:via-[#202225] dark:to-[#202225] dark:border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-sky-300">
          <FontAwesomeIcon icon={faFileLines} className="text-sky-500 dark:text-sky-300" />
          Files
        </div>
        <div className="text-xs text-sky-500 dark:text-sky-200">{files.length} file</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
          />
        ))}
      </div>
      {files.length > visibleFiles.length && <div ref={loadMoreRef} className="mt-4 h-6" />}
    </section>
  )
}

export default FileList
