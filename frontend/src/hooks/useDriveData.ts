import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  createFolder,
  renameFolder,
  renameFile,
  getFolder,
  deleteFile,
  deleteFolder,
  downloadFileBlob,
  downloadFolderBlob,
  viewFileBlob,
  viewFileThumbnailBlob,
  downloadFileWithMeta
} from '../services/driveService'
import { getUniqueName, isModel } from '../services/driveUtils'
import type {
  FileItem,
  FolderItem,
  PathItem,
  PreviewMap,
  SelectedItems
} from '../types'

export interface UseDriveDataResult {
  folderId: string
  folders: FolderItem[]
  files: FileItem[]
  path: PathItem[]
  loading: boolean
  error: string
  previews: PreviewMap
  selectedFolderId: string | null
  editingFolderId: string | null
  editingName: string
  previewTarget: FileItem | null
  previewVisible: boolean
  previewOpenAt: number
  isMobile: boolean
  setError: Dispatch<SetStateAction<string>>
  setLoading: Dispatch<SetStateAction<boolean>>
  setFolderId: Dispatch<SetStateAction<string>>
  setSelectedFolderId: Dispatch<SetStateAction<string | null>>
  setEditingFolderId: Dispatch<SetStateAction<string | null>>
  setEditingName: Dispatch<SetStateAction<string>>
  setVisibleFiles: Dispatch<SetStateAction<FileItem[]>>
  loadFolder: (id: string) => Promise<void>
  handleCreateFolder: () => Promise<void>
  handleRenameFolder: (folderIdToRename: string, nextName: string) => Promise<void>
  handleRenameFile: (fileIdToRename: string, nextName: string) => Promise<boolean>
  handleDeleteFolder: (folder: FolderItem) => Promise<void>
  handleDeleteFile: (file: FileItem) => Promise<void>
  handleDownloadFile: (file: FileItem) => Promise<void>
  handleDownloadFolder: (folder: FolderItem) => Promise<void>
  openPreview: (file: FileItem) => void
  openPreviewById: (filePublicId: string) => Promise<void>
  closePreview: () => void
  selectedItems: SelectedItems
  setSelectedItems: Dispatch<SetStateAction<SelectedItems>>
}

const useDriveData = (): UseDriveDataResult => {
  const [folderId, setFolderId] = useState('root')
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [path, setPath] = useState<PathItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [previews, setPreviews] = useState<PreviewMap>({})
  const previewUrlsRef = useRef<Record<string, string>>({})
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewOpenAt, setPreviewOpenAt] = useState(0)
  const [visibleFiles, setVisibleFiles] = useState<FileItem[]>([])
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({ files: [], folders: [] })

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 768px)').matches
  }, [])

  const buildFolderPath = useCallback(async (folder: FolderItem): Promise<PathItem[]> => {
    const nextPath: PathItem[] = []
    let current: FolderItem | null | undefined = folder
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
    async (id: string) => {
      setLoading(true)
      setError('')
      setSelectedItems({ files: [], folders: [] })
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
        setError((err as Error).message || 'Gagal memuat folder.')
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
      const nextPreviews: PreviewMap = {}
      const nextUrls: Record<string, string> = { ...previewUrlsRef.current }

      for (const file of visibleFiles) {
        const name = file.filename || file.originalName || file.name || ''
        const hasModelThumbnail = Boolean(file.thumbnailName) && isModel(name)
        const isPreview =
          file.fileType?.startsWith('image/') ||
          file.fileType?.startsWith('video/') ||
          hasModelThumbnail
        if (!isPreview) {
          continue
        }
        if (nextUrls[file.publicId]) {
          nextPreviews[file.publicId] = {
            url: nextUrls[file.publicId],
            type: hasModelThumbnail ? 'image/jpeg' : (file.fileType as string)
          }
          continue
        }
        try {
          const blob = hasModelThumbnail
            ? await viewFileThumbnailBlob(file.publicId)
            : await viewFileBlob(file.publicId)
          if (controller.signal.aborted) return
          const url = URL.createObjectURL(blob)
          nextUrls[file.publicId] = url
          nextPreviews[file.publicId] = {
            url,
            type: hasModelThumbnail ? 'image/jpeg' : (file.fileType as string)
          }
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

  const closePreview = useCallback(() => {
    setPreviewVisible(false)
    setPreviewTarget(null)
  }, [])

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
      setError((err as Error).message || 'Gagal membuat folder.')
    }
  }

  const handleRenameFolder = async (folderIdToRename: string, nextName: string) => {
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
      setError((err as Error).message || 'Gagal rename folder.')
    } finally {
      setEditingFolderId(null)
      setEditingName('')
    }
  }

  const handleRenameFile = async (fileIdToRename: string, nextName: string): Promise<boolean> => {
    const name = nextName.trim()
    if (!name) {
      setError('Nama file tidak boleh kosong.')
      return false
    }
    const duplicate = files.some(
      (item) =>
        item.publicId !== fileIdToRename &&
        (item.filename || item.originalName || item.name || '').trim().toLowerCase() ===
          name.toLowerCase()
    )
    if (duplicate) {
      setError('Nama file sudah ada. Gunakan nama lain.')
      return false
    }
    setError('')
    try {
      const updated = await renameFile(fileIdToRename, name)
      setFiles((prev) =>
        prev.map((item) => (item.publicId === updated.publicId ? { ...item, ...updated } : item))
      )
      return true
    } catch (err) {
      setError((err as Error).message || 'Gagal rename file.')
      return false
    }
  }

  const handleDeleteFolder = async (folder: FolderItem) => {
    const confirmed = window.confirm('Hapus folder ini beserta isinya?')
    if (!confirmed) return
    setError('')
    try {
      await deleteFolder(folder.publicId)
      setSelectedFolderId((prev) => (prev === folder.publicId ? null : prev))
      loadFolder(folderId)
    } catch (err) {
      setError((err as Error).message || 'Gagal menghapus folder.')
    }
  }

  const handleDeleteFile = async (file: FileItem) => {
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
      setError((err as Error).message || 'Gagal menghapus file.')
    }
  }

  const handleDownloadFile = async (file: FileItem) => {
    setError('')
    try {
      const blob = await downloadFileBlob(file.publicId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.filename || file.originalName || file.name || 'file'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError((err as Error).message || 'Gagal download file.')
    }
  }

  const handleDownloadFolder = async (folder: FolderItem) => {
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
      setError((err as Error).message || 'Gagal download folder.')
    }
  }

  const openPreview = useCallback((file: FileItem) => {
    setPreviewTarget(file)
    setPreviewVisible(true)
    setPreviewOpenAt(Date.now())
  }, [])

  const openPreviewById = useCallback(
    async (filePublicId: string) => {
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
        setError((err as Error).message || 'Gagal memuat preview.')
      }
    },
    [files]
  )

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
    setLoading,
    setFolderId,
    setSelectedFolderId,
    setEditingFolderId,
    setEditingName,
    setVisibleFiles,
    loadFolder,
    handleCreateFolder,
    handleRenameFolder,
    handleRenameFile,
    handleDeleteFolder,
    handleDeleteFile,
    handleDownloadFile,
    handleDownloadFolder,
    openPreview,
    openPreviewById,
    closePreview,
    selectedItems,
    setSelectedItems
  }
}

export default useDriveData
