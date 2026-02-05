import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShareNodes } from '@fortawesome/free-solid-svg-icons'
import { getUser, setToken, setUser } from '../lib/api.js'
import { isModel } from '../services/driveUtils.js'
import useDriveData from '../hooks/useDriveData.js'
import useUploadQueue from '../hooks/useUploadQueue.js'
import useShare from '../hooks/useShare.js'
import useTitle from '../components/hooks/useTitle.js'
import DriveHeader from '../components/drive/DriveHeader.jsx'
import FolderList from '../components/drive/FolderList.jsx'
import FileList from '../components/drive/FileList.jsx'
import DriveSidebar from '../components/drive/DriveSidebar.jsx'
import PreviewModal from '../components/PreviewModal.jsx'
import DriveSkeleton from '../components/skeleton/DriveSkeleton.jsx'

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}

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
  } = drive
  const uploadQueue = useUploadQueue()
  useEffect(() => {
    uploadQueue.setConfig({
      folderId,
      onUploaded: loadFolder,
      setError,
      existingFileNames: files.map((file) => file.filename || file.originalName || file.name || '')
    })
  }, [uploadQueue, folderId, loadFolder, setError, files])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(''), 3000)
    return () => clearTimeout(timer)
  }, [error, setError])
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

  const totalStorageBytes = useMemo(
    () => files.reduce((total, item) => total + (item?.size || 0), 0),
    [files]
  )
  const storageLabel = formatBytes(totalStorageBytes)

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#1A1B1D] dark:text-slate-100">
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
      <div className="flex min-h-screen relative z-10">
        <DriveSidebar onCreateFolder={handleCreateFolder} storageLabel={storageLabel} />
        <div className="flex-1 min-w-0">
          <DriveHeader
            user={user}
            canManage={canManage}
            onAdmin={() => navigate('/admin')}
            onLogout={handleLogout}
            path={path}
            onBreadcrumb={handleBreadcrumb}
            onUpload={uploadQueue.handleUpload}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
          />
          {error && (
            <div className="fixed top-4 right-4 z-50 max-w-sm text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 shadow-lg dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300">
              {error}
            </div>
          )}
          <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
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
                />
              </div>
            )}
          </main>
        </div>
      </div>
      <PreviewModal
        open={previewVisible}
        file={previewTarget}
        previews={previews}
        isModel={isModel}
        onClose={handleClosePreview}
        openAt={previewOpenAt}
      />
    </div>
  )
}

export default Drive
