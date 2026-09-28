import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookmark, faChevronLeft, faChevronRight, faFileArrowDown } from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import DriveHeader from '../components/drive/DriveHeader'
import FolderCard from '../components/drive/FolderCard'
import FileCard from '../components/drive/FileCard'
import DriveSkeleton from '../components/skeleton/DriveSkeleton'
import PreviewModal from '../components/PreviewModal'
import useI18n from '../components/i18/useI18n'
import useTitle from '../components/hooks/useTitle'
import useDriveLayout from '../hooks/useDriveLayout'
import { getUser, setToken, setUser } from '../lib/api'
import {
  downloadFileBlob,
  downloadFolderBlob,
  getSavedItems,
  getStorageUsage,
  removeSavedItem,
  viewFileBlob
} from '../services/driveService'
import { formatBytes, isModel } from '../services/driveUtils'
import type { FileItem, FolderItem, PreviewMap, SavedItem } from '../types'

const PAGE_SIZE = 30

interface ToastState {
  type: 'success' | 'error'
  message: string
}

interface SavedFolderEntry {
  id: number
  available: boolean
  folder: FolderItem
}

interface SavedFileEntry {
  id: number
  available: boolean
  file: FileItem
}

const Saved = () => {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { setSidebarOpen, setSidebarActions } = useDriveLayout() ?? {}
  const [items, setItems] = useState<SavedItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveToast, setSaveToast] = useState<ToastState | null>(null)
  const [previews, setPreviews] = useState<PreviewMap>({})
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewOpenAt, setPreviewOpenAt] = useState(0)
  const [menuFolderId, setMenuFolderId] = useState<number | null>(null)
  const [menuFileId, setMenuFileId] = useState<number | null>(null)
  const previewUrlsRef = useRef<PreviewMap>({})
  const user = useMemo(() => getUser(), [])
  const isMobile = useMemo(() => window.matchMedia('(max-width: 768px)').matches, [])

  useTitle(`${t('saved')} - PeakDrive`)

  useEffect(() => {
    let cancelled = false
    const loadStorage = async () => {
      try {
        const usage = await getStorageUsage()
        if (cancelled) return
        const label = formatBytes(usage?.totalBytes || 0)
        setSidebarActions?.({
          onCreateFolder: null,
          storageLabel: label,
          createFolderDisabled: true
        })
      } catch {
        if (cancelled) return
        setSidebarActions?.({
          onCreateFolder: null,
          storageLabel: '0 B',
          createFolderDisabled: true
        })
      }
    }
    loadStorage()
    return () => {
      cancelled = true
    }
  }, [setSidebarActions])

  useEffect(() => {
    let cancelled = false
    const loadSaved = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await getSavedItems(page, PAGE_SIZE)
        if (cancelled) return
        setItems(response?.items || [])
        setTotal(response?.total || 0)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : t('savedLoadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadSaved()
    return () => {
      cancelled = true
    }
  }, [page, t])

  useEffect(() => {
    if (!saveToast) return
    const timer = setTimeout(() => setSaveToast(null), 3000)
    return () => clearTimeout(timer)
  }, [saveToast])

  useEffect(() => {
    const handleClick = () => {
      setMenuFolderId(null)
      setMenuFileId(null)
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const savedFolders = useMemo<SavedFolderEntry[]>(
    () =>
      items
        .filter((item) => item.targetType === 'folder')
        .map((item) => ({
          id: item.id,
          available: item.available,
          folder: {
            publicId: item.folder?.publicId || `missing-folder-${item.id}`,
            name: item.folder?.name || t('savedUnavailableName'),
            createdAt: item.folder?.createdAt
          }
        })),
    [items, t]
  )

  const savedFiles = useMemo<SavedFileEntry[]>(
    () =>
      items
        .filter((item) => item.targetType === 'file')
        .map((item) => ({
          id: item.id,
          available: item.available,
          file: {
            publicId: item.file?.publicId || `missing-file-${item.id}`,
            filename: item.file?.filename || t('savedUnavailableName'),
            fileType: item.file?.fileType,
            size: item.file?.size,
            uploadedAt: item.file?.uploadedAt
          }
        })),
    [items, t]
  )

  useEffect(() => {
    let cancelled = false
    const used = new Set<string>()
    const loadPreviews = async () => {
      const nextPreviews: PreviewMap = {}
      const nextUrls: PreviewMap = { ...previewUrlsRef.current }
      for (const entry of savedFiles) {
        if (!entry.available) continue
        const file = entry.file
        if (!file?.publicId || !file?.fileType) continue
        const isImage = file.fileType.startsWith('image/')
        const isVideo = file.fileType.startsWith('video/')
        const isModelFile = isModel(file.fileType)
        if (!isImage && !isVideo && !isModelFile) continue
        used.add(file.publicId)
        if (nextUrls[file.publicId]) {
          nextPreviews[file.publicId] = nextUrls[file.publicId]
          continue
        }
        try {
          const blob = await viewFileBlob(file.publicId)
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          const preview = { url, type: file.fileType }
          nextUrls[file.publicId] = preview
          nextPreviews[file.publicId] = preview
        } catch {
          if (cancelled) return
        }
      }
      Object.keys(nextUrls).forEach((key) => {
        if (!used.has(key)) {
          URL.revokeObjectURL(nextUrls[key].url)
          delete nextUrls[key]
        }
      })
      previewUrlsRef.current = nextUrls
      if (!cancelled) setPreviews(nextPreviews)
    }
    loadPreviews()
    return () => {
      cancelled = true
    }
  }, [savedFiles])

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((preview) => {
        URL.revokeObjectURL(preview.url)
      })
      previewUrlsRef.current = {}
    }
  }, [])

  const handleDownloadFile = async (file: FileItem) => {
    try {
      const blob = await downloadFileBlob(file.publicId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.filename || `file-${file.publicId}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setSaveToast({ type: 'error', message: t('downloadError') })
    }
  }

  const handleDownloadFolder = async (folder: FolderItem) => {
    try {
      const blob = await downloadFolderBlob(folder.publicId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${folder.name || 'folder'}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setSaveToast({ type: 'error', message: t('downloadError') })
    }
  }

  const handleRemoveSaved = async (itemId: number) => {
    try {
      await removeSavedItem(itemId)
      setItems((prev) => prev.filter((item) => item.id !== itemId))
      setTotal((prev) => Math.max(0, prev - 1))
      setSaveToast({ type: 'success', message: t('removeFromSavedSuccess') })
    } catch (err) {
      setSaveToast({
        type: 'error',
        message: err instanceof Error ? err.message : t('removeFromSavedError')
      })
    }
  }

  const pageButtons = useMemo<(number | '...')[]>(() => {
    const buttons: (number | '...')[] = []
    const maxButtons = 5
    const start = Math.max(1, page - Math.floor(maxButtons / 2))
    const end = Math.min(totalPages, start + maxButtons - 1)
    if (start > 1) {
      buttons.push(1)
      if (start > 2) buttons.push('...')
    }
    for (let i = start; i <= end; i += 1) {
      buttons.push(i)
    }
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push('...')
      buttons.push(totalPages)
    }
    return buttons
  }, [page, totalPages])

  const path = useMemo(() => [{ publicId: 'saved', name: t('saved') }], [t])

  return (
    <div className="h-screen w-full flex flex-col">
      {saveToast && (
        <div className="fixed top-16 right-4 z-50">
          <div
            className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-medium border shadow-lg ${
              saveToast.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300'
                : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300'
            }`}
          >
            {saveToast.message}
          </div>
        </div>
      )}
      <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200/40 dark:bg-[#161719] dark:border-slate-800/40">
        <DriveHeader
          user={user}
          canManage={false}
          onAdmin={() => navigate('/admin')}
          onLogout={() => {
            setToken(null)
            setUser(null)
            navigate('/login')
          }}
          onTrash={() => {}}
          onActivityLog={() => {}}
          path={path}
          onBreadcrumb={(index) => {
            if (index === -1) {
              navigate('/drive')
            }
          }}
          onUpload={() => {}}
          showUpload={false}
          showTrash={false}
          showSearch={false}
          searchValue=""
          onSearchChange={() => {}}
          onToggleSidebar={() => setSidebarOpen?.((value) => !value)}
        />
      </div>
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden">
        <div className="w-full px-8 py-8">
          <main className="w-full space-y-6">
            {loading ? (
              <DriveSkeleton />
            ) : (
              <div className="grid gap-6">
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-950/40 dark:border-red-900/60">
                    {error}
                  </div>
                )}
                {!error && items.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-[#202225] dark:text-slate-300">
                    {t('savedEmpty')}
                  </div>
                )}
                {savedFolders.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2 text-lg font-medium text-slate-800 dark:text-slate-100">
                        <FontAwesomeIcon icon={faBookmark} className="text-sky-500 text-base" />
                        {t('folders')}
                      </div>
                      <div className="text-xs font-medium text-slate-500/80 dark:text-slate-400/80">
                        {savedFolders.length} {t('folder')}
                      </div>
                    </div>
                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                      {savedFolders.map((entry) => (
                        <FolderCard
                          key={entry.id}
                          folder={entry.folder}
                          isMobile={isMobile}
                          selected={false}
                          onSelect={() => {}}
                          onOpen={() => {
                            if (!entry.available) return
                            navigate(`/drive/folders/${entry.folder.publicId}`)
                          }}
                          editing={false}
                          editingName=""
                          onEditingNameChange={() => {}}
                          onRename={() => {}}
                          onCancelRename={() => {}}
                          inputRef={null}
                          menuOpen={menuFolderId === entry.id}
                          onMenuToggle={() =>
                            setMenuFolderId((prev) => (prev === entry.id ? null : entry.id))
                          }
                          onDownload={() => {
                            if (!entry.available) return
                            handleDownloadFolder(entry.folder)
                          }}
                          onShare={() => {}}
                          onDelete={() => {}}
                          onDropUpload={() => {}}
                          multiSelected={false}
                          onToggleSelect={() => {}}
                          selectionMode={false}
                          statusLabel={entry.available ? '' : t('savedUnavailable')}
                          disabled={!entry.available}
                          menuItems={[
                            {
                              label: t('download'),
                              icon: faFileArrowDown,
                              tone: 'text-slate-700 dark:text-slate-200',
                              onClick: () => {
                                if (!entry.available) return
                                handleDownloadFolder(entry.folder)
                                setMenuFolderId(null)
                              }
                            },
                            {
                              label: t('removeFromSaved'),
                              icon: faBookmark,
                              tone: 'text-red-600',
                              onClick: () => {
                                handleRemoveSaved(entry.id)
                                setMenuFolderId(null)
                              }
                            }
                          ]}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {savedFiles.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2 text-lg font-medium text-slate-800 dark:text-slate-100">
                        <FontAwesomeIcon icon={faBookmark} className="text-indigo-500 text-base" />
                        {t('files')}
                      </div>
                      <div className="text-xs font-medium text-slate-500/80 dark:text-slate-400/80">
                        {savedFiles.length} {t('file')}
                      </div>
                    </div>
                    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                      {savedFiles.map((entry) => (
                        <FileCard
                          key={entry.id}
                          file={entry.file}
                          previews={previews}
                          isMobile={isMobile}
                          onOpen={() => {
                            if (!entry.available) return
                            setPreviewTarget(entry.file)
                            setPreviewOpenAt(Date.now())
                            setPreviewVisible(true)
                          }}
                          onDownload={() => {
                            if (!entry.available) return
                            handleDownloadFile(entry.file)
                          }}
                          onShare={() => {}}
                          onDelete={() => {}}
                          menuOpen={menuFileId === entry.id}
                          onMenuToggle={() => setMenuFileId((prev) => (prev === entry.id ? null : entry.id))}
                          multiSelected={false}
                          onToggleSelect={() => {}}
                          selectionMode={false}
                          statusLabel={entry.available ? '' : t('savedUnavailable')}
                          disabled={!entry.available}
                          menuItems={[
                            {
                              label: t('download'),
                              icon: faFileArrowDown,
                              tone: 'text-slate-700 dark:text-slate-200',
                              onClick: () => {
                                if (!entry.available) return
                                handleDownloadFile(entry.file)
                                setMenuFileId(null)
                              }
                            },
                            {
                              label: t('removeFromSaved'),
                              icon: faBookmark,
                              tone: 'text-red-600',
                              onClick: () => {
                                handleRemoveSaved(entry.id)
                                setMenuFileId(null)
                              }
                            }
                          ]}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {total > PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 ${
                        page === 1
                          ? 'text-slate-400 border-slate-200 bg-slate-100 cursor-not-allowed dark:border-slate-700 dark:bg-[#1F2023]'
                          : 'text-slate-700 border-slate-200 bg-white hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:bg-[#1F2023] dark:hover:bg-[#2a2c30]'
                      }`}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                      {t('prev')}
                    </button>
                    {pageButtons.map((btn, index) =>
                      btn === '...' ? (
                        <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                          ...
                        </span>
                      ) : (
                        <button
                          key={btn}
                          type="button"
                          onClick={() => setPage(btn)}
                          className={`px-3 py-2 rounded-xl border text-sm font-medium ${
                            page === btn
                              ? 'text-white border-sky-500 bg-sky-500'
                              : 'text-slate-700 border-slate-200 bg-white hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:bg-[#1F2023] dark:hover:bg-[#2a2c30]'
                          }`}
                        >
                          {btn}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page === totalPages}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 ${
                        page === totalPages
                          ? 'text-slate-400 border-slate-200 bg-slate-100 cursor-not-allowed dark:border-slate-700 dark:bg-[#1F2023]'
                          : 'text-slate-700 border-slate-200 bg-white hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:bg-[#1F2023] dark:hover:bg-[#2a2c30]'
                      }`}
                    >
                      {t('next')}
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                )}
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
        openAt={previewOpenAt}
        onDownload={() => {
          if (!previewTarget) return
          handleDownloadFile(previewTarget)
        }}
        onClose={() => {
          setPreviewTarget(null)
          setPreviewVisible(false)
        }}
      />
    </div>
  )
}

export default Saved
