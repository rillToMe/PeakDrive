import { useEffect, useMemo } from 'react'
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
import PreviewModal from '../components/PreviewModal.jsx'
import DriveSkeleton from '../components/skeleton/DriveSkeleton.jsx'

const Drive = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { folderPublicId: folderPublicIdParam, filePublicId: filePublicIdParam } = useParams()
  const user = useMemo(() => getUser(), [])
  const canManage = user?.role === 'MasterAdmin' || user?.role === 'Admin'

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
      setError
    })
  }, [uploadQueue, folderId, loadFolder, setError])
  const share = useShare(setError)

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
    <div className="min-h-screen bg-slate-50">
      <DriveHeader
        user={user}
        canManage={canManage}
        onAdmin={() => navigate('/admin')}
        onLogout={handleLogout}
        path={path}
        onBreadcrumb={handleBreadcrumb}
        onUpload={uploadQueue.handleUpload}
        onCreateFolder={handleCreateFolder}
      />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
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
              folders={folders}
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
              files={files}
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
