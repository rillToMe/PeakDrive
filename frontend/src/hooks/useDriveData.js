import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createFolder,
  renameFolder,
  getFolder,
  deleteFile,
  deleteFolder,
  downloadFileBlob,
  downloadFolderBlob,
  viewFileBlob,
  downloadFileWithMeta
} from '../services/driveService.js'
import { getUniqueName, isModel } from '../services/driveUtils.js'

const MODEL_PREVIEW_LIMIT_MB = 200

const useDriveData = () => {
  const [folderId, setFolderId] = useState('root')
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [path, setPath] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [editingFolderId, setEditingFolderId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [previews, setPreviews] = useState({})
  const previewUrlsRef = useRef({})
  const [previewTarget, setPreviewTarget] = useState(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewOpenAt, setPreviewOpenAt] = useState(0)
  const [visibleFiles, setVisibleFiles] = useState([])

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 768px)').matches
  }, [])

  const buildFolderPath = useCallback(async (folder) => {
    const nextPath = []
    let current = folder
    while (current) {
      nextPath.unshift({ publicId: current.publicId, name: current.name })
      if (!current.parentPublicId) {
        break
      }
      const parentData = await getFolder(current.parentPublicId)
      current = parentData.folder
      if (!current) {
        break
      }
    }
    return nextPath
  }, [])

  const loadFolder = useCallback(
    async (id) => {
      setLoading(true)
      setError('')
      try {
        const data = await getFolder(id)
        setFolders(data.folders || [])
        setFiles(data.files || [])
        if (id === 'root') {
          setPath([])
        } else if (data.folder) {
          const nextPath = await buildFolderPath(data.folder)
          setPath(nextPath)
        }
      } catch (err) {
        setError(err.message || 'Gagal memuat folder.')
      } finally {
        setLoading(false)
      }
    },
    [buildFolderPath]
  )

  useEffect(() => {
    loadFolder(folderId)
  }, [folderId, loadFolder])

  useEffect(() => {
    const controller = new AbortController()
    const loadPreviews = async () => {
      const nextPreviews = {}
      const nextUrls = { ...previewUrlsRef.current }

      for (const file of visibleFiles) {
        const name = file.filename || file.originalName || file.name || ''
        const isLargeModel = isModel(name) && file.size > MODEL_PREVIEW_LIMIT_MB * 1024 * 1024
        const isPreview =
          file.fileType?.startsWith('image/') ||
          file.fileType?.startsWith('video/') ||
          (isModel(name) && !isMobile && !isLargeModel)
        if (!isPreview) {
          continue
        }
        if (nextUrls[file.publicId]) {
          nextPreviews[file.publicId] = { url: nextUrls[file.publicId], type: file.fileType }
          continue
        }
        try {
          const blob = await viewFileBlob(file.publicId)
          if (controller.signal.aborted) return
          const url = URL.createObjectURL(blob)
          nextUrls[file.publicId] = url
          nextPreviews[file.publicId] = { url, type: file.fileType }
        } catch {
          continue
        }
      }

      previewUrlsRef.current = nextUrls
      setPreviews(nextPreviews)
    }

    loadPreviews()
    return () => controller.abort()
  }, [visibleFiles, isMobile])

  const handleCreateFolder = async () => {
    setError('')
    try {
      const nextName = getUniqueName('New Folder', folders.map((item) => item.name || ''))
      const created = await createFolder(nextName, folderId === 'root' ? null : folderId)
      setFolders((prev) => [created, ...prev])
      setSelectedFolderId(created.publicId)
      setEditingFolderId(created.publicId)
      setEditingName(created.name)
      loadFolder(folderId)
    } catch (err) {
      setError(err.message || 'Gagal membuat folder.')
    }
  }

  const handleRenameFolder = async (folderIdToRename, nextName) => {
    const name = nextName.trim()
    if (!name) {
      setEditingFolderId(null)
      setEditingName('')
      return
    }
    const duplicate = folders.some(
      (item) =>
        item.publicId !== folderIdToRename &&
        (item.name || '').trim().toLowerCase() === name.toLowerCase()
    )
    if (duplicate) {
      setError('Nama folder sudah ada. Gunakan nama lain.')
      return
    }
    setError('')
    try {
      const updated = await renameFolder(folderIdToRename, name)
      setFolders((prev) => prev.map((item) => (item.publicId === updated.publicId ? updated : item)))
      setPath((prev) =>
        prev.map((item) =>
          item.publicId === updated.publicId ? { ...item, name: updated.name } : item
        )
      )
    } catch (err) {
      setError(err.message || 'Gagal rename folder.')
    } finally {
      setEditingFolderId(null)
      setEditingName('')
    }
  }

  const handleDeleteFolder = async (folder) => {
    const confirmed = window.confirm('Hapus folder ini beserta isinya?')
    if (!confirmed) return
    setError('')
    try {
      await deleteFolder(folder.publicId)
      setSelectedFolderId((prev) => (prev === folder.publicId ? null : prev))
      loadFolder(folderId)
    } catch (err) {
      setError(err.message || 'Gagal menghapus folder.')
    }
  }

  const handleDeleteFile = async (file) => {
    const confirmed = window.confirm('Hapus file ini?')
    if (!confirmed) return
    setError('')
    try {
      await deleteFile(file.publicId)
      setFiles((prev) => prev.filter((item) => item.publicId !== file.publicId))
      setPreviews((prev) => {
        const next = { ...prev }
        delete next[file.publicId]
        return next
      })
      const url = previewUrlsRef.current[file.publicId]
      if (url) {
        URL.revokeObjectURL(url)
        const nextUrls = { ...previewUrlsRef.current }
        delete nextUrls[file.publicId]
        previewUrlsRef.current = nextUrls
      }
      if (previewTarget?.publicId === file.publicId) {
        closePreview()
      }
    } catch (err) {
      setError(err.message || 'Gagal menghapus file.')
    }
  }

  const handleDownloadFile = async (file) => {
    setError('')
    try {
      const blob = await downloadFileBlob(file.publicId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.filename || file.originalName || file.name
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || 'Gagal download file.')
    }
  }

  const handleDownloadFolder = async (folder) => {
    setError('')
    try {
      const blob = await downloadFolderBlob(folder.publicId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${folder.name}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message || 'Gagal download folder.')
    }
  }

  const openPreview = useCallback((file) => {
    setPreviewTarget(file)
    setPreviewVisible(true)
    setPreviewOpenAt(Date.now())
  }, [])

  const openPreviewById = useCallback(
    async (filePublicId) => {
      setError('')
      try {
        const cachedUrl = previewUrlsRef.current[filePublicId]
        if (cachedUrl) {
          const cachedFile = files.find((item) => item.publicId === filePublicId)
          if (cachedFile) {
            setPreviewTarget(cachedFile)
            setPreviewVisible(true)
            setPreviewOpenAt(Date.now())
            return
          }
        }
        const { blob, filename, contentType } = await downloadFileWithMeta(filePublicId)
        const url = cachedUrl || URL.createObjectURL(blob)
        if (!cachedUrl) {
          previewUrlsRef.current = { ...previewUrlsRef.current, [filePublicId]: url }
          setPreviews((prev) => ({ ...prev, [filePublicId]: { url, type: contentType } }))
        }
        setPreviewTarget({
          publicId: filePublicId,
          filename,
          fileType: contentType,
          size: blob.size,
          uploadedAt: new Date().toISOString()
        })
        setPreviewVisible(true)
        setPreviewOpenAt(Date.now())
      } catch (err) {
        setError(err.message || 'Gagal memuat preview.')
      }
    },
    [files]
  )

  const closePreview = () => {
    setPreviewVisible(false)
    setPreviewTarget(null)
  }

  return {
    folderId,
    folders,
    files,
    path,
    loading,
    error,
    previews,
    selectedFolderId,
    editingFolderId,
    editingName,
    previewTarget,
    previewVisible,
    previewOpenAt,
    isMobile,
    setError,
    setFolderId,
    setSelectedFolderId,
    setEditingFolderId,
    setEditingName,
    setVisibleFiles,
    loadFolder,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleDeleteFile,
    handleDownloadFile,
    handleDownloadFolder,
    openPreview,
    openPreviewById,
    closePreview
  }
}

export default useDriveData
