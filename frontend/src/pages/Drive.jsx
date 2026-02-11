import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShareNodes, faXmark } from '@fortawesome/free-solid-svg-icons'
import { getUser, setToken, setUser } from '../lib/api.js'
import { formatBytes, getUniqueFileName, isModel } from '../services/driveUtils.js'
import {
  cleanTrash,
  createFolder,
  checkFolderExists,
    deleteFile,
    deleteFolder,
  deleteTrashFilePermanently,
  deleteTrashFolderPermanently,
  getActivityLogs,
  getStorageUsage,
  getTrash,
  restoreTrashFile,
  restoreTrashFolder
} from '../services/driveService.js'
import useDriveData from '../hooks/useDriveData.js'
import useUploadQueue from '../hooks/useUploadQueue.js'
import useShare from '../hooks/useShare.js'
import useTitle from '../components/hooks/useTitle.js'
import DriveHeader from '../components/drive/DriveHeader.jsx'
import FolderList from '../components/drive/FolderList.jsx'
import FileList from '../components/drive/FileList.jsx'
import DriveSidebar from '../components/drive/DriveSidebar.jsx'
import PreviewModal from '../components/PreviewModal.jsx'
import FolderExistsModal from '../components/drive/FolderExistsModal.jsx'
import MultiSelectActionBar from '../components/drive/MultiSelectActionBar.jsx'
import DriveSkeleton from '../components/skeleton/DriveSkeleton.jsx'
import readDroppedEntries from '../utils/readDroppedEntries.js'

const Drive = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { folderPublicId: folderPublicIdParam, filePublicId: filePublicIdParam } = useParams()
  const user = useMemo(() => getUser(), [])
  const canManage = user?.role === 'MasterAdmin' || user?.role === 'Admin'
  const [searchTerm, setSearchTerm] = useState('')
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('peakdrive-theme') || 'device')
  const [shootingStarsEnabled, setShootingStarsEnabled] = useState(
    () => localStorage.getItem('peakdrive-exp-shooting-stars') === 'true'
  )
  const [storageBytes, setStorageBytes] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [trashLoading, setTrashLoading] = useState(false)
  const [trashError, setTrashError] = useState('')
  const [trashFiles, setTrashFiles] = useState([])
  const [trashFolders, setTrashFolders] = useState([])
  const [cleanDays, setCleanDays] = useState(30)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')
  const [logs, setLogs] = useState([])
  const [logsTake, setLogsTake] = useState(200)
  const [uploadNotice, setUploadNotice] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [folderExistsModal, setFolderExistsModal] = useState({ open: false, folderName: '', onContinue: null })

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
      existingFileNames: files.map((file) => file.filename || file.originalName || file.name || '')
    })
  }, [uploadQueue, folderId, loadFolder, setError, files])

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
  const share = useShare(setError)

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
          setError(err.message || 'Gagal memuat total penyimpanan.')
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
    const handleEsc = (e) => {
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

    setLoading(true)
    setError('')
    try {
      // Loop delete for now as requested to not change API
      for (const fId of selectedItems.folders) {
        await deleteFolder(fId)
      }
      for (const fId of selectedItems.files) {
        await deleteFile(fId)
      }
      setSelectedItems({ files: [], folders: [] })
      await loadFolder(folderId)
    } catch (err) {
      setError(err.message || 'Gagal menghapus beberapa item.')
      await loadFolder(folderId)
    } finally {
      setLoading(false)
    }
  }

  const isSelectionActive = selectedItems.files.length > 0 || selectedItems.folders.length > 0

  const navigateWithSearch = (path) => {
    navigate(`${path}${location.search || ''}`)
  }

  const handleOpenFolder = (folder) => {
    navigateWithSearch(`/drive/folders/${folder.publicId}`)
  }

  const handleOpenFile = (file) => {
    navigateWithSearch(`/drive/files/${file.publicId}`)
  }

  const handleBreadcrumb = (index) => {
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

  const loadTrash = useCallback(async () => {
    setTrashLoading(true)
    setTrashFiles([])
    setTrashFolders([])
    setTrashError('')
    try {
      const data = await getTrash()
      setTrashFolders(data?.folders || [])
      setTrashFiles(data?.files || [])
    } catch (err) {
      setTrashError(err.message || 'Gagal memuat trash.')
    } finally {
      setTrashLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!trashOpen) return
    loadTrash()
  }, [trashOpen, loadTrash])

  const handleRestoreTrashFile = async (file) => {
    setTrashError('')
    try {
      await restoreTrashFile(file.publicId)
      setTrashFiles((prev) => prev.filter((item) => item.publicId !== file.publicId))
    } catch (err) {
      setTrashError(err.message || 'Gagal restore file.')
    }
  }

  const handleRestoreTrashFolder = async (folder) => {
    setTrashError('')
    try {
      await restoreTrashFolder(folder.publicId)
      setTrashFolders((prev) => prev.filter((item) => item.publicId !== folder.publicId))
    } catch (err) {
      setTrashError(err.message || 'Gagal restore folder.')
    }
  }

  const handleDeleteTrashFile = async (file) => {
    const confirmed = window.confirm('Hapus permanen file ini?')
    if (!confirmed) return
    setTrashError('')
    try {
      await deleteTrashFilePermanently(file.publicId)
      setTrashFiles((prev) => prev.filter((item) => item.publicId !== file.publicId))
    } catch (err) {
      setTrashError(err.message || 'Gagal hapus permanen file.')
    }
  }

  const handleDeleteTrashFolder = async (folder) => {
    const confirmed = window.confirm('Hapus permanen folder ini beserta isinya?')
    if (!confirmed) return
    setTrashError('')
    try {
      await deleteTrashFolderPermanently(folder.publicId)
      setTrashFolders((prev) => prev.filter((item) => item.publicId !== folder.publicId))
    } catch (err) {
      setTrashError(err.message || 'Gagal hapus permanen folder.')
    }
  }

  const handleCleanTrash = async () => {
    setTrashError('')
    try {
      // Retention-based cleanup: bersihkan item lebih tua dari cleanDays
      await cleanTrash(Number(cleanDays) || 30)
      await loadTrash()
    } catch (err) {
      setTrashError(err.message || 'Gagal membersihkan trash.')
    }
  }

  const loadActivityLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError('')
    try {
      const data = await getActivityLogs(Number(logsTake) || 200)
      setLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      setLogsError(err.message || 'Gagal memuat activity log.')
    } finally {
      setLogsLoading(false)
    }
  }, [logsTake])

  useEffect(() => {
    if (!logsOpen) return
    if (!canManage) return
    loadActivityLogs()
  }, [logsOpen, canManage, loadActivityLogs])

  const handleDropUpload = async (targetFolderId, droppedEntries, supportsFolders) => {
    if (!supportsFolders) {
      setError('Folder drag & drop tidak didukung di browser ini.')
    }
    if (droppedEntries.length === 0) return

    // 1. Persiapkan context upload
    const existingNames =
      targetFolderId === folderId
        ? files.map((file) => file.filename || file.originalName || file.name || '')
        : []
    const existingFolderNames =
      targetFolderId === folderId
        ? folders.map((f) => f.name)
        : []
    
    const folderCache = new Map()
    const fileNamePools = new Map()
    const folderNamePools = new Map()
    
    const targetFilePool = new Set(existingNames.map((name) => name.trim().toLowerCase()))
    fileNamePools.set(targetFolderId, targetFilePool)
    
    const targetFolderPool = new Set(existingFolderNames.map((name) => name.trim().toLowerCase()))
    folderNamePools.set(targetFolderId, targetFolderPool)

    // 2. Helper untuk auto-rename folder
    const getUniqueFolderName = (name, parentId) => {
      const pool = folderNamePools.get(parentId) || new Set()
      const existing = Array.from(pool)
      const safeName = name?.trim() || 'New Folder'
      
      const normalize = (val) => val.trim().toLowerCase()
      const stripIndex = (val) => {
        const match = val.match(/^(.*)\s\((\d+)\)$/)
        return match ? { base: match[1], index: Number(match[2]) } : { base: val, index: 0 }
      }
      
      const { base } = stripIndex(safeName)
      let index = 0
      let candidate = base
      while (pool.has(normalize(candidate))) {
        index += 1
        candidate = `${base} (${index})`
      }
      return candidate
    }

    const ensureFolder = async (parentId, name, isRootEntry = false) => {
      const key = `${parentId}|${name.toLowerCase()}`
      let existingId = folderCache.get(key)
      if (!existingId) {
        let finalName = name
        // Jika ini entry root (folder yang di-drop langsung), gunakan pool untuk rename
        if (isRootEntry) {
          const pool = folderNamePools.get(parentId) || new Set()
          finalName = getUniqueFolderName(name, parentId)
          pool.add(finalName.toLowerCase())
        }
        
        const created = await createFolder(finalName, parentId === 'root' ? null : parentId)
        existingId = created.publicId
        folderCache.set(key, existingId)
      }
      return existingId
    }

    const getPool = (parentId) => {
      const existing = fileNamePools.get(parentId)
      if (existing) return existing
      const next = new Set()
      fileNamePools.set(parentId, next)
      return next
    }

    const uploadFileEntry = async (file, parentId, nameOverride) => {
      if (!file) return
      const pool = getPool(parentId)
      const name = nameOverride || file.name
      const uniqueName = getUniqueFileName(name, Array.from(pool))
      pool.add(uniqueName.toLowerCase())
      const finalFile =
        uniqueName !== file.name
          ? new File([file], uniqueName, { type: file.type, lastModified: file.lastModified })
          : file
      await uploadQueue.startUpload?.(finalFile, parentId)
    }

    const uploadEntry = async (entry, parentId, isRootEntry = false) => {
      if (entry.type === 'file') {
        await uploadFileEntry(entry.file, parentId, entry.name)
        return
      }
      if (entry.type === 'folder') {
        setUploadNotice(`Mengupload folder: ${entry.name}`)
        const folderId = await ensureFolder(parentId, entry.name, isRootEntry)
        for (const child of entry.children || []) {
          await uploadEntry(child, folderId, false)
        }
      }
    }

    const startExecution = async () => {
      uploadQueue.beginBatch?.()
      try {
        for (const entry of droppedEntries) {
          await uploadEntry(entry, targetFolderId, true)
        }
      } finally {
        uploadQueue.endBatch?.()
      }
    }

    // 3. Cek konflik folder di root drop secara async via Backend
    try {
      const foldersInDrop = droppedEntries.filter(e => e.type === 'folder')
      
      for (const entry of foldersInDrop) {
        const { exists } = await checkFolderExists(entry.name, targetFolderId)
        if (exists) {
          setFolderExistsModal({
            open: true,
            folderName: entry.name,
            onContinue: () => {
              setFolderExistsModal({ open: false, folderName: '', onContinue: null })
              startExecution()
            }
          })
          return
        }
      }
    } catch (err) {
      console.error('Check folder exists failed:', err)
      // Jika cek gagal, kita tetap lanjut saja (fail-safe) atau tampilkan error?
      // Sesuai instruksi UX, kita sebaiknya sangat hati-hati. 
      // Tapi untuk saat ini kita biarkan lanjut jika network error.
    }

    startExecution()
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
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget.contains(event.relatedTarget)) return
            setIsDragging(false)
          }}
          onDrop={async (event) => {
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
                Lepas file untuk upload ke folder ini
              </div>
            </div>
          )}
          <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200/40 dark:bg-[#161719] dark:border-slate-800/40">
            <DriveHeader
              user={user}
              canManage={canManage}
              onAdmin={() => navigate('/admin')}
              onLogout={handleLogout}
              onTrash={() => setTrashOpen(true)}
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
            />
          </div>
          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden">
            <div className="w-full px-8 py-8">
              <main className="w-full space-y-6">
                {share.shareUrl && (
                  <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2">
                    <FontAwesomeIcon icon={faShareNodes} />
                    <span>Share link:</span>
                    <a className="text-slate-900 underline" href={share.shareUrl}>
                      {share.shareUrl}
                    </a>
                  </div>
                )}
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
                      onShareFolder={share.handleFolderShareCopy}
                      onDeleteFolder={handleDeleteFolder}
                      copiedFolderId={share.copiedFolderId}
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
                      isMobile={isMobile}
                      onOpenFile={handleOpenFile}
                      onDownload={handleDownloadFile}
                      onShare={share.handleShareCopy}
                      onDelete={handleDeleteFile}
                      onVisibleFilesChange={setVisibleFiles}
                      copiedFileId={share.copiedFileId}
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
      {trashOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 py-6" onClick={() => setTrashOpen(false)}>
          <div
            className="w-full max-w-5xl max-h-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#202225]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-rose-500">Trash</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Trash / Recycle Bin</div>
                <div className="text-sm text-slate-500 dark:text-slate-300">
                  File & folder akan dibersihkan otomatis setelah 30 hari.
                </div>
              </div>
              <button
                onClick={() => setTrashOpen(false)}
                className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {trashError && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-950/40 dark:border-red-900/60">
                  {trashError}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={loadTrash}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30]"
                >
                  Refresh
                </button>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={cleanDays}
                      onChange={(event) => setCleanDays(event.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-100"
                    />
                    <button
                      onClick={handleCleanTrash}
                      className="px-3 py-2 rounded-xl bg-rose-600 text-white text-sm hover:bg-rose-500"
                    >
                      Clean Trash
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-[#1F2023]">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 sticky top-0 bg-slate-50/60 dark:bg-[#1F2023] pb-2 mb-1">Folders</div>
                  <div className="space-y-2">
                    {trashLoading && <div className="text-sm text-slate-400">Memuat...</div>}
                    {!trashLoading && trashFolders.length === 0 && (
                      <div className="text-sm text-slate-400">Trash folder kosong.</div>
                    )}
                    {trashFolders.map((folder) => (
                      <div key={folder.publicId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#202225]">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate dark:text-slate-100">{folder.name}</div>
                          <div className="text-xs text-slate-400">
                            Dihapus {new Date(folder.deletedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestoreTrashFolder(folder)}
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeleteTrashFolder(folder)}
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-900/30"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-[#1F2023]">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 sticky top-0 bg-slate-50/60 dark:bg-[#1F2023] pb-2 mb-1">Files</div>
                  <div className="space-y-2">
                    {trashLoading && <div className="text-sm text-slate-400">Memuat...</div>}
                    {!trashLoading && trashFiles.length === 0 && (
                      <div className="text-sm text-slate-400">Trash file kosong.</div>
                    )}
                    {trashFiles.map((file) => (
                      <div key={file.publicId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#202225]">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate dark:text-slate-100">
                            {file.filename || file.originalName || file.name || 'File'}
                          </div>
                          <div className="text-xs text-slate-400">
                            Dihapus {new Date(file.deletedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestoreTrashFile(file)}
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeleteTrashFile(file)}
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-900/30"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
      {logsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={() => setLogsOpen(false)}>
          <div
            className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 dark:border-slate-700 dark:bg-[#202225]"
            onClick={(event) => event.stopPropagation()}
          >
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
              <input
                type="number"
                min="1"
                max="1000"
                value={logsTake}
                onChange={(event) => setLogsTake(event.target.value)}
                className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-100"
              />
              <button
                onClick={loadActivityLogs}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30]"
              >
                Refresh
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              {logsLoading ? (
                <div className="text-sm text-slate-400">Memuat...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b dark:text-slate-400 dark:border-slate-700">
                      <th className="py-2">User</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th>Message</th>
                      <th>Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-4 text-center text-slate-400">
                          Belum ada activity.
                        </td>
                      </tr>
                    )}
                    {logs.map((log) => (
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
              )}
            </div>
          </div>
        </div>
      )}
      <PreviewModal
        open={previewVisible}
        file={previewTarget}
        previews={previews}
        isModel={isModel}
        onClose={handleClosePreview}
        openAt={previewOpenAt}
      />
      {folderExistsModal.open && (
        <FolderExistsModal
          folderName={folderExistsModal.folderName}
          onCancel={() => setFolderExistsModal({ open: false, folderName: '', onContinue: null })}
          onContinue={folderExistsModal.onContinue}
        />
      )}
    </div>
  )
}

export default Drive
