import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { getUser, setToken, setUser } from '../lib/api'
import { formatBytes, isModel } from '../services/driveUtils'
import {
  deleteFile,
  deleteFolder,
  getActivityLogs,
  getStorageUsage
} from '../services/driveService'
import useDriveData from '../hooks/useDriveData'
import useUploadQueue from '../hooks/useUploadQueue'
import useTitle from '../components/hooks/useTitle'
import { useShareSheet } from '../components/ui/shareSheetContext'
import DriveHeader from '../components/drive/DriveHeader'
import FolderList from '../components/drive/FolderList'
import FileList from '../components/drive/FileList'
import DriveSidebar from '../components/drive/DriveSidebar'
import PreviewModal from '../components/PreviewModal'
import MultiSelectActionBar from '../components/drive/MultiSelectActionBar'
import DriveSkeleton from '../components/skeleton/DriveSkeleton'
import readDroppedEntries from '../utils/readDroppedEntries'
import type { ActivityLogItem, FileItem, FolderItem, StoredUser } from '../types'

type DetailTarget =
  | { item: FolderItem; type: 'folder' }
  | { item: FileItem; type: 'file' }

interface DetailRow {
  label: string
  value: string
}

type LogPageButton =
  | { type: 'page'; value: number; key: string }
  | { type: 'ellipsis'; key: string }

const Drive = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { folderPublicId: folderPublicIdParam, filePublicId: filePublicIdParam } = useParams<{
    folderPublicId?: string
    filePublicId?: string
  }>()
  const user = useMemo<StoredUser | null>(() => getUser(), [])
  const canManage = user?.role === 'MasterAdmin' || user?.role === 'Admin'
  const [searchTerm, setSearchTerm] = useState('')
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('peakdrive-theme') || 'device')
  const [shootingStarsEnabled, setShootingStarsEnabled] = useState(
    () => localStorage.getItem('peakdrive-exp-shooting-stars') === 'true'
  )
  const [storageBytes, setStorageBytes] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')
  const [logs, setLogs] = useState<ActivityLogItem[]>([])
  const [logsPage, setLogsPage] = useState(1)
  const [logsUserFilter, setLogsUserFilter] = useState('')
  const [logsSort, setLogsSort] = useState('newest')
  const [logsTypeFilter, setLogsTypeFilter] = useState('all')
  const [logsActionFilter, setLogsActionFilter] = useState('all')
  const [uploadNotice, setUploadNotice] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)

  const drive = useDriveData()
  const {
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
  } = drive
  const uploadQueue = useUploadQueue()
  useEffect(() => {
    uploadQueue.setConfig({
      folderId,
      onAllUploaded: loadFolder,
      setError,
      setUploadNotice,
      existingFileNames: files.map((file) => file.filename || file.originalName || file.name || ''),
      existingFolderNames: folders.map((folder) => folder.name || '')
    })
  }, [uploadQueue, folderId, loadFolder, setError, setUploadNotice, files, folders])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(''), 3000)
    return () => clearTimeout(timer)
  }, [error, setError])
  useEffect(() => {
    if (!uploadNotice) return
    const timer = setTimeout(() => setUploadNotice(''), 3000)
    return () => clearTimeout(timer)
  }, [uploadNotice])
  const { openShare } = useShareSheet()

  const handleOpenDetail = useCallback((item: FolderItem | FileItem, type: 'file' | 'folder') => {
    setDetailTarget({ item, type } as DetailTarget)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailTarget(null)
  }, [])

  const detailItem = detailTarget?.item
  const detailType = detailTarget?.type
  const detailTitle = detailType === 'folder' ? 'Detail Folder' : 'Detail File'
  const detailRows: DetailRow[] = detailTarget
    ? detailType === 'folder'
      ? [
          { label: 'Nama', value: (detailItem as FolderItem)?.name || '-' },
          {
            label: 'Dibuat',
            value: (detailItem as FolderItem)?.createdAt
              ? new Date((detailItem as FolderItem).createdAt as string).toLocaleString()
              : '-'
          },
          { label: 'ID', value: detailItem?.publicId || '-' }
        ]
      : [
          {
            label: 'Nama',
            value:
              (detailItem as FileItem)?.filename ||
              (detailItem as FileItem)?.originalName ||
              (detailItem as FileItem)?.name ||
              '-'
          },
          { label: 'Tipe', value: (detailItem as FileItem)?.fileType || '-' },
          {
            label: 'Ukuran',
            value: Number.isFinite((detailItem as FileItem)?.size)
              ? formatBytes((detailItem as FileItem).size)
              : '-'
          },
          {
            label: 'Upload',
            value: (detailItem as FileItem)?.uploadedAt
              ? new Date((detailItem as FileItem).uploadedAt as string).toLocaleString()
              : '-'
          },
          { label: 'ID', value: detailItem?.publicId || '-' }
        ]
    : []

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleThemeUpdate = () => setThemeMode(localStorage.getItem('peakdrive-theme') || 'device')
    media.addEventListener('change', handleThemeUpdate)
    window.addEventListener('storage', handleThemeUpdate)
    window.addEventListener('theme-change', handleThemeUpdate)
    return () => {
      media.removeEventListener('change', handleThemeUpdate)
      window.removeEventListener('storage', handleThemeUpdate)
      window.removeEventListener('theme-change', handleThemeUpdate)
    }
  }, [])

  useEffect(() => {
    const handleExperimentalUpdate = () => {
      setShootingStarsEnabled(localStorage.getItem('peakdrive-exp-shooting-stars') === 'true')
    }
    window.addEventListener('storage', handleExperimentalUpdate)
    window.addEventListener('experiment-change', handleExperimentalUpdate)
    return () => {
      window.removeEventListener('storage', handleExperimentalUpdate)
      window.removeEventListener('experiment-change', handleExperimentalUpdate)
    }
  }, [])

  const resolvedTheme = useMemo(() => {
    if (themeMode === 'device') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeMode
  }, [themeMode])

  const showShootingStars = resolvedTheme === 'dark' && shootingStarsEnabled
  const stars = useMemo(
    () => [
      { id: 'star-1', left: 8, top: -12, delay: 1.5, duration: 7.5, size: 1.6, opacity: 0.7 },
      { id: 'star-2', left: 22, top: -18, delay: 4.2, duration: 8.4, size: 1.2, opacity: 0.6 },
      { id: 'star-3', left: 36, top: -8, delay: 9.5, duration: 9.6, size: 1.8, opacity: 0.75 },
      { id: 'star-4', left: 52, top: -20, delay: 6.8, duration: 8.9, size: 1.4, opacity: 0.65 },
      { id: 'star-5', left: 68, top: -14, delay: 12.1, duration: 10.2, size: 1.9, opacity: 0.8 },
      { id: 'star-6', left: 82, top: -6, delay: 15.3, duration: 9.2, size: 1.3, opacity: 0.6 },
      { id: 'star-7', left: 94, top: -16, delay: 18.7, duration: 10.8, size: 1.5, opacity: 0.7 }
    ],
    []
  )

  useEffect(() => {
    let cancelled = false
    const loadStorage = async () => {
      try {
        const data = await getStorageUsage()
        if (!cancelled) {
          setStorageBytes(data?.totalBytes || 0)
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Gagal memuat total penyimpanan.')
        }
      }
    }
    loadStorage()
    return () => {
      cancelled = true
    }
  }, [files, setError])

  const storageLabel = formatBytes(storageBytes)

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredFolders = useMemo(() => {
    if (!normalizedSearch) return folders
    return folders.filter((folder) => folder.name?.toLowerCase().includes(normalizedSearch))
  }, [folders, normalizedSearch])
  const filteredFiles = useMemo(() => {
    if (!normalizedSearch) return files
    return files.filter((file) => {
      const label = file.filename || file.originalName || file.name || ''
      return label.toLowerCase().includes(normalizedSearch)
    })
  }, [files, normalizedSearch])

  const activeFolderName = path.length > 0 ? path[path.length - 1].name : ''
  useTitle(activeFolderName ? `${activeFolderName} - PeakDrive` : 'PeakDrive')

  useEffect(() => {
    if (folderPublicIdParam) {
      if (folderPublicIdParam !== folderId) {
        setFolderId(folderPublicIdParam)
      }
      return
    }
    if (!filePublicIdParam && folderId !== 'root') {
      setFolderId('root')
    }
  }, [folderPublicIdParam, filePublicIdParam, folderId, setFolderId])

  useEffect(() => {
    if (!filePublicIdParam) return
    const existing = files.find((file) => file.publicId === filePublicIdParam)
    if (existing) {
      openPreview(existing)
    } else {
      openPreviewById(filePublicIdParam)
    }
  }, [filePublicIdParam, files, openPreview, openPreviewById])

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    navigate('/login')
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedItems({ files: [], folders: [] })
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [setSelectedItems])

  const handleBatchDelete = async () => {
    const total = selectedItems.files.length + selectedItems.folders.length
    if (total === 0) return
    const confirmed = window.confirm(`Hapus ${total} item yang dipilih?`)
    if (!confirmed) return

    setBatchDeleting(true)
    setLoading(true)
    setError('')
    try {
      for (const fId of selectedItems.folders) {
        await deleteFolder(fId)
      }
      for (const fId of selectedItems.files) {
        await deleteFile(fId)
      }
      setSelectedItems({ files: [], folders: [] })
      await loadFolder(folderId)
    } catch (err) {
      setError((err as Error).message || 'Gagal menghapus beberapa item.')
      await loadFolder(folderId)
    } finally {
      setLoading(false)
      setBatchDeleting(false)
    }
  }

  const navigateWithSearch = (pathValue: string) => {
    navigate(`${pathValue}${location.search || ''}`)
  }

  const handleOpenFolder = (folder: FolderItem) => {
    navigateWithSearch(`/drive/folders/${folder.publicId}`)
  }

  const handleOpenFile = (file: FileItem) => {
    navigateWithSearch(`/drive/files/${file.publicId}`)
  }

  const handleBreadcrumb = (index: number) => {
    if (index === -1) {
      navigateWithSearch('/drive')
      return
    }
    const target = path[index]
    if (target) {
      navigateWithSearch(`/drive/folders/${target.publicId}`)
    }
  }

  const handleClosePreview = () => {
    closePreview()
    if (!filePublicIdParam) return
    if (folderPublicIdParam) {
      navigateWithSearch(`/drive/folders/${folderPublicIdParam}`)
      return
    }
    navigateWithSearch('/drive')
  }

  const logsPerPage = 100
  const canNextPage = logs.length >= logsPage * logsPerPage
  const canPrevPage = logsPage > 1
  const logPageButtons = useMemo<LogPageButton[]>(() => {
    const items: LogPageButton[] = [{ type: 'page', value: 1, key: 'page-1' }]
    if (logsPage > 2) {
      items.push({ type: 'ellipsis', key: 'ellipsis-left' })
    }
    if (logsPage > 1) {
      items.push({ type: 'page', value: logsPage, key: `page-${logsPage}` })
    }
    if (canNextPage) {
      if (logsPage >= 2) {
        items.push({ type: 'ellipsis', key: 'ellipsis-right' })
      }
      items.push({ type: 'page', value: logsPage + 1, key: `page-${logsPage + 1}` })
    }
    return items
  }, [logsPage, canNextPage])

  const filteredLogs = useMemo(() => {
    const normalizedUser = logsUserFilter.trim().toLowerCase()
    const is3d = (name: string) => /\.(glb|gltf|fbx|obj|stl|ply|dae)$/i.test(name)
    const isText = (name: string) => /\.(txt|md|csv|json|log|xml|yaml|yml)$/i.test(name)
    const getFileNameFromMessage = (message: string) => {
      if (!message) return ''
      const match = message.match(/([\w\-.]+\.(?:glb|gltf|fbx|obj|stl|ply|dae|txt|md|csv|json|log|xml|yaml|yml|png|jpg|jpeg|gif|pdf|docx?|xlsx?|pptx?|zip|rar|7z))/i)
      return match ? match[1] : message
    }
    const matchesType = (log: ActivityLogItem) => {
      if (logsTypeFilter === 'all') return true
      const filename = getFileNameFromMessage(log.message)
      if (!filename) return logsTypeFilter === 'other'
      if (logsTypeFilter === '3d') return is3d(filename)
      if (logsTypeFilter === 'text') return isText(filename)
      if (logsTypeFilter === 'other') return !is3d(filename) && !isText(filename)
      return true
    }
    const matchesAction = (log: ActivityLogItem) => {
      if (logsActionFilter === 'all') return true
      const action = String(log.action || '').toLowerCase()
      if (logsActionFilter === 'delete') {
        return action.includes('delete') || action.includes('trash') || action.includes('clean')
      }
      if (logsActionFilter === 'upload') return action.includes('upload')
      if (logsActionFilter === 'share') return action.includes('share')
      if (logsActionFilter === 'create') return action.includes('create')
      if (logsActionFilter === 'other') {
        return !action.includes('delete') && !action.includes('trash') && !action.includes('clean') &&
          !action.includes('upload') && !action.includes('share') && !action.includes('create')
      }
      return true
    }
    const result = logs.filter((log) => {
      if (normalizedUser && !String(log.userEmail || '').toLowerCase().includes(normalizedUser)) {
        return false
      }
      if (!matchesType(log)) return false
      if (!matchesAction(log)) return false
      return true
    })
    const sorted = [...result]
    sorted.sort((a, b) => {
      if (logsSort === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return sorted
  }, [logs, logsUserFilter, logsSort, logsTypeFilter, logsActionFilter])

  const pagedLogs = useMemo(() => {
    const start = (logsPage - 1) * logsPerPage
    return filteredLogs.slice(start, start + logsPerPage)
  }, [filteredLogs, logsPage])

  useEffect(() => {
    if (logsLoading) return
    if (logsPage <= 1) return
    const minCount = (logsPage - 1) * logsPerPage
    if (filteredLogs.length < minCount) {
      const lastPage = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage))
      setLogsPage(lastPage)
    }
  }, [logsLoading, logsPage, filteredLogs.length])

  const loadActivityLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError('')
    try {
      const data = await getActivityLogs(logsPage * logsPerPage)
      setLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      setLogsError((err as Error).message || 'Gagal memuat activity log.')
    } finally {
      setLogsLoading(false)
    }
  }, [logsPage])

  useEffect(() => {
    if (!logsOpen) return
    if (!canManage) return
    loadActivityLogs()
  }, [logsOpen, canManage, loadActivityLogs])

  const handleLogsPageChange = (nextPage: number) => {
    if (logsLoading) return
    setLogsPage(nextPage)
  }

  const handleDropUpload = (
    targetFolderId: string,
    droppedEntries: Parameters<typeof uploadQueue.handleDropUpload>[0]['entries'],
    supportsFolders: boolean
  ) => {
    uploadQueue.handleDropUpload?.({
      targetFolderId,
      entries: droppedEntries,
      supportsFolders
    })
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#1A1B1D] dark:text-slate-100">
      {showShootingStars && (
        <div className="shooting-stars">
          {stars.map((star) => (
            <span
              key={star.id}
              className="shooting-star"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                animationDelay: `${star.delay}s`,
                animationDuration: `${star.duration}s`,
                opacity: star.opacity,
                height: `${star.size}px`,
                width: `${80 + star.size * 40}px`
              }}
            />
          ))}
        </div>
      )}
      <div className="flex h-screen w-full relative z-10 overflow-hidden">
        <div
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={`fixed inset-y-0 left-0 z-50 w-72 transform transition md:static md:translate-x-0 md:z-auto md:flex ${
            sidebarOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full'
          }`}
        >
          <DriveSidebar
            onCreateFolder={handleCreateFolder}
            storageLabel={storageLabel}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
        <div
          className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden"
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault()
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            setIsDragging(false)
          }}
          onDrop={async (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault()
            setIsDragging(false)
            const { entries, supportsFolders } = await readDroppedEntries(event.dataTransfer)
            if (entries.length === 0) {
              if (!supportsFolders) setError('Folder drag & drop tidak didukung di browser ini.')
              return
            }
            handleDropUpload(folderId, entries, supportsFolders)
          }}
        >
          {error && (
            <div className="fixed top-4 right-4 z-50 max-w-sm text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 shadow-lg dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300">
              {error}
            </div>
          )}
          {uploadNotice && (
            <div className="fixed top-16 right-4 z-50 max-w-sm text-sm text-sky-700 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 shadow-lg dark:bg-sky-950/40 dark:border-sky-900/60 dark:text-sky-200">
              {uploadNotice}
            </div>
          )}
          {isDragging && (
            <div className="fixed inset-0 z-40 bg-black/20 flex items-center justify-center">
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-xl dark:border-slate-700 dark:bg-[#202225] dark:text-slate-100">
                Lepaskan file atau folder untuk upload
              </div>
            </div>
          )}
          <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200/40 dark:bg-[#161719] dark:border-slate-800/40">
            <DriveHeader
              user={user}
              canManage={canManage}
              onAdmin={() => navigate('/admin')}
              onLogout={handleLogout}
              onTrash={() => navigate('/trash')}
              onActivityLog={() => setLogsOpen(true)}
              path={path}
              onBreadcrumb={handleBreadcrumb}
              onUpload={uploadQueue.handleUpload}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              onToggleSidebar={() => setSidebarOpen((value) => !value)}
            />
            <MultiSelectActionBar
              selectedCount={selectedItems.files.length + selectedItems.folders.length}
              onClear={() => setSelectedItems({ files: [], folders: [] })}
              onDelete={handleBatchDelete}
              onShare={() => {}}
              onDownload={() => {}}
              isDeleting={batchDeleting}
            />
          </div>
          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden">
            <div className="w-full px-8 py-8">
              <main className="w-full space-y-6">
                {loading ? (
                  <DriveSkeleton />
                ) : (
                  <div className="grid gap-6">
                    <FolderList
                      folders={filteredFolders}
                      isMobile={isMobile}
                      selectedFolderId={selectedFolderId}
                      setSelectedFolderId={setSelectedFolderId}
                      editingFolderId={editingFolderId}
                      editingName={editingName}
                      setEditingFolderId={setEditingFolderId}
                      setEditingName={setEditingName}
                      onRenameFolder={handleRenameFolder}
                      onOpenFolder={handleOpenFolder}
                      onDownloadFolder={handleDownloadFolder}
                      onShareFolder={openShare}
                      onDetailFolder={(folder) => handleOpenDetail(folder, 'folder')}
                      onDeleteFolder={handleDeleteFolder}
                      onDropUpload={(folder, entries, supportsFolders) =>
                        handleDropUpload(folder.publicId, entries, supportsFolders)
                      }
                      selectedItems={selectedItems}
                      setSelectedItems={setSelectedItems}
                    />
                    <FileList
                      key={folderId}
                      files={filteredFiles}
                      previews={previews}
                      onOpenFile={handleOpenFile}
                      onDownload={handleDownloadFile}
                      onRenameFile={handleRenameFile}
                      onShare={openShare}
                      onDetail={(file) => handleOpenDetail(file, 'file')}
                      onDelete={handleDeleteFile}
                      onVisibleFilesChange={setVisibleFiles}
                      selectedItems={selectedItems}
                      setSelectedItems={setSelectedItems}
                    />
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
      {detailTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={handleCloseDetail} />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-sm border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#202225] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-slate-700/80">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-sky-500">Detail</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{detailTitle}</div>
              </div>
              <button
                onClick={handleCloseDetail}
                className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-[#1F2023]">
                <div className="space-y-3 text-sm">
                  {detailRows.map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-3">
                      <div className="text-slate-500 dark:text-slate-400">{row.label}</div>
                      <div className="text-slate-900 dark:text-slate-100 font-medium text-right break-all">
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
      {logsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 py-6" onClick={() => setLogsOpen(false)}>
          <div
            className="w-full max-w-5xl max-h-[85vh] h-full rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 dark:border-slate-700 dark:bg-[#202225] flex flex-col relative"
            onClick={(event) => event.stopPropagation()}
          >
            {logsLoading && (
              <div className="absolute top-4 right-4 z-10">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-200">
                  <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-transparent animate-spin dark:border-slate-500" />
                  Memuat activity log...
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-sky-500">Admin</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Activity Log</div>
                <div className="text-sm text-slate-500 dark:text-slate-300">Monitoring aktivitas akun.</div>
              </div>
              <button
                onClick={() => setLogsOpen(false)}
                className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            {logsError && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-950/40 dark:border-red-900/60">
                {logsError}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={loadActivityLogs}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30]"
              >
                Refresh
              </button>
              <input
                type="text"
                value={logsUserFilter}
                onChange={(event) => {
                  setLogsUserFilter(event.target.value)
                  setLogsPage(1)
                }}
                placeholder="Filter user"
                className="min-w-[160px] px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-100"
              />
              <select
                value={logsSort}
                onChange={(event) => {
                  setLogsSort(event.target.value)
                  setLogsPage(1)
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-100"
              >
                <option value="newest">Paling baru</option>
                <option value="oldest">Paling lama</option>
              </select>
              <select
                value={logsTypeFilter}
                onChange={(event) => {
                  setLogsTypeFilter(event.target.value)
                  setLogsPage(1)
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-100"
              >
                <option value="all">Semua jenis</option>
                <option value="3d">File 3D</option>
                <option value="text">File text</option>
                <option value="other">Lainnya</option>
              </select>
              <select
                value={logsActionFilter}
                onChange={(event) => {
                  setLogsActionFilter(event.target.value)
                  setLogsPage(1)
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-100"
              >
                <option value="all">Semua aksi</option>
                <option value="delete">Hapus</option>
                <option value="upload">Upload</option>
                <option value="share">Share</option>
                <option value="create">Create</option>
                <option value="other">Lainnya</option>
              </select>
              <div className="ml-auto flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                <button
                  onClick={() => handleLogsPageChange(Math.max(1, logsPage - 1))}
                  disabled={!canPrevPage || logsLoading}
                  className={`px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm ${
                    !canPrevPage || logsLoading
                      ? 'opacity-50 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-[#2a2c30]'
                  } dark:border-slate-700`}
                >
                  Prev
                </button>
                <button
                  onClick={() => handleLogsPageChange(1)}
                  disabled={logsLoading}
                  className={`px-2.5 py-1.5 rounded-lg border ${
                    logsPage === 1
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30]'
                  }`}
                >
                  1
                </button>
                {logPageButtons
                  .filter((item) => !('value' in item) || item.value !== 1)
                  .map((item) =>
                    item.type === 'ellipsis' ? (
                      <span key={item.key} className="px-1 text-slate-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item.key}
                        onClick={() => handleLogsPageChange(item.value)}
                        disabled={logsLoading}
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          logsPage === item.value
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30]'
                        }`}
                      >
                        {item.value}
                      </button>
                    )
                  )}
                <button
                  onClick={() => handleLogsPageChange(logsPage + 1)}
                  disabled={!canNextPage || logsLoading}
                  className={`px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm ${
                    !canNextPage || logsLoading
                      ? 'opacity-50 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-[#2a2c30]'
                  } dark:border-slate-700`}
                >
                  Next
                </button>
              </div>
            </div>
            <div className="mt-4 flex-1 min-h-0 overflow-hidden">
              {logsLoading ? (
                <div className="text-sm text-slate-400">Memuat...</div>
              ) : (
                <div className="max-h-full overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-[#202225]">
                      <tr className="text-left text-slate-500 border-b dark:text-slate-400 dark:border-slate-700">
                        <th className="py-2">User</th>
                        <th>Action</th>
                        <th>Status</th>
                        <th>Message</th>
                        <th>Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400">
                            Belum ada activity.
                          </td>
                        </tr>
                      )}
                      {pagedLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-b-0 align-top dark:border-slate-700">
                          <td className="py-3">{log.userEmail || '-'}</td>
                          <td className="py-3">{log.action}</td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                log.status === 'success'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : log.status === 'error'
                                  ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-[#1F2023] dark:text-slate-300'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3">{log.message}</td>
                          <td className="py-3">{new Date(log.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {!logsLoading && (
              <div className="pt-3 text-xs text-slate-400">
                Menampilkan {pagedLogs.length} dari {filteredLogs.length} log
              </div>
            )}
          </div>
        </div>
      )}
      <PreviewModal
        open={previewVisible}
        file={previewTarget}
        previews={previews}
        isModel={isModel}
        onClose={handleClosePreview}
        onDownload={handleDownloadFile}
        onShare={openShare}
        onDelete={handleDeleteFile}
        openAt={previewOpenAt}
      />
    </div>
  )
}

export default Drive
