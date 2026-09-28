import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import {
  cleanTrash,
  deleteTrashFilePermanently,
  deleteTrashFolderPermanently,
  getStorageUsage,
  getTrash,
  restoreTrashFile,
  restoreTrashFolder
} from '../services/driveService'
import { formatBytes } from '../services/driveUtils'
import DriveSidebar from '../components/drive/DriveSidebar'
import useTitle from '../components/hooks/useTitle'
import useDriveData from '../hooks/useDriveData'
import type { TrashFile, TrashFolder } from '../types'

type DeleteTarget =
  | { type: 'file'; item: TrashFile }
  | { type: 'folder'; item: TrashFolder }

interface TrashToast {
  type: 'success' | 'error'
  message: string
}

const Trash = () => {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [trashLoading, setTrashLoading] = useState(false)
  const [trashError, setTrashError] = useState('')
  const [trashFiles, setTrashFiles] = useState<TrashFile[]>([])
  const [trashFolders, setTrashFolders] = useState<TrashFolder[]>([])
  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false)
  const [trashCleaning, setTrashCleaning] = useState(false)
  const [trashToast, setTrashToast] = useState<TrashToast | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [trashDeleting, setTrashDeleting] = useState(false)
  const [storageBytes, setStorageBytes] = useState(0)

  const {
    handleCreateFolder,
    error: driveError,
    setError: setDriveError
  } = useDriveData()

  useTitle('Trash - PeakDrive')

  useEffect(() => {
    if (!driveError) return
    const timer = setTimeout(() => setDriveError(''), 3000)
    return () => clearTimeout(timer)
  }, [driveError, setDriveError])

  useEffect(() => {
    if (!trashToast) return
    const timer = setTimeout(() => setTrashToast(null), 3000)
    return () => clearTimeout(timer)
  }, [trashToast])

  useEffect(() => {
    let cancelled = false
    const loadStorage = async () => {
      try {
        const data = await getStorageUsage()
        if (!cancelled) {
          setStorageBytes(data?.totalBytes || 0)
        }
      } catch {
        if (!cancelled) {
          setStorageBytes(0)
        }
      }
    }
    loadStorage()
    return () => {
      cancelled = true
    }
  }, [])

  const storageLabel = useMemo(() => formatBytes(storageBytes), [storageBytes])

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
      setTrashError((err as Error).message || 'Gagal memuat trash.')
    } finally {
      setTrashLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrash()
  }, [loadTrash])

  const handleRestoreTrashFile = async (file: TrashFile) => {
    setTrashError('')
    try {
      await restoreTrashFile(file.publicId)
      setTrashFiles((prev) => prev.filter((item) => item.publicId !== file.publicId))
    } catch (err) {
      setTrashError((err as Error).message || 'Gagal restore file.')
    }
  }

  const handleRestoreTrashFolder = async (folder: TrashFolder) => {
    setTrashError('')
    try {
      await restoreTrashFolder(folder.publicId)
      setTrashFolders((prev) => prev.filter((item) => item.publicId !== folder.publicId))
    } catch (err) {
      setTrashError((err as Error).message || 'Gagal restore folder.')
    }
  }

  const handleDeleteTrashFile = (file: TrashFile) => {
    setDeleteTarget({ type: 'file', item: file })
  }

  const handleDeleteTrashFolder = (folder: TrashFolder) => {
    setDeleteTarget({ type: 'folder', item: folder })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setTrashDeleting(true)
    setTrashError('')
    try {
      if (deleteTarget.type === 'file') {
        await deleteTrashFilePermanently(deleteTarget.item.publicId)
        setTrashFiles((prev) => prev.filter((item) => item.publicId !== deleteTarget.item.publicId))
      } else {
        await deleteTrashFolderPermanently(deleteTarget.item.publicId)
        setTrashFolders((prev) => prev.filter((item) => item.publicId !== deleteTarget.item.publicId))
      }
    } catch (err) {
      setTrashError(
        (err as Error).message ||
          (deleteTarget.type === 'file'
            ? 'Gagal hapus permanen file.'
            : 'Gagal hapus permanen folder.')
      )
    } finally {
      setTrashDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleCleanTrash = () => {
    if (trashCleaning) return
    setTrashConfirmOpen(true)
  }

  const handleConfirmCleanTrash = async () => {
    setTrashError('')
    setTrashToast(null)
    setTrashConfirmOpen(false)
    setTrashCleaning(true)
    try {
      await cleanTrash()
      setTrashFiles([])
      setTrashFolders([])
      setTrashToast({ type: 'success', message: 'Trash berhasil dibersihkan' })
    } catch (err) {
      setTrashToast({ type: 'error', message: (err as Error).message || 'Gagal membersihkan trash.' })
    } finally {
      setTrashCleaning(false)
    }
  }

  const deleteTitle = deleteTarget?.type === 'folder' ? 'Hapus permanen folder?' : 'Hapus permanen file?'
  const deleteDescription =
    deleteTarget?.type === 'folder'
      ? 'Folder ini beserta isinya akan dihapus permanen. Aksi ini tidak bisa dibatalkan.'
      : 'File ini akan dihapus permanen. Aksi ini tidak bisa dibatalkan.'

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#1A1B1D] dark:text-slate-100">
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
        <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
          {driveError && (
            <div className="fixed top-4 right-4 z-50 max-w-sm text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 shadow-lg dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300">
              {driveError}
            </div>
          )}
          <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200/40 dark:bg-[#161719] dark:border-slate-800/40">
            <div className="w-full px-6 py-5 md:px-8 md:py-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen((value) => !value)}
                    className="md:hidden h-10 w-10 rounded-full border border-slate-200/70 bg-white text-slate-600 shadow-sm hover:bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-[#202225] dark:text-slate-200 dark:hover:bg-[#2a2c30]"
                  >
                    <FontAwesomeIcon icon={faBars} />
                  </button>
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-rose-500">Trash</div>
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Trash</h1>
                    <div className="text-sm text-slate-500 dark:text-slate-300">
                      File & folder akan dibersihkan otomatis setelah 30 hari.
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate('/drive')}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 flex items-center gap-2 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30]"
                >
                  <FontAwesomeIcon icon={faArrowLeft} className="text-[12px]" />
                  Kembali
                </button>
                <button
                  onClick={loadTrash}
                  disabled={trashCleaning}
                  className={`px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30] ${
                    trashCleaning ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Refresh
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCleanTrash}
                    disabled={trashCleaning}
                    className={`px-3 py-2 rounded-xl bg-rose-600 text-white text-sm hover:bg-rose-500 ${
                      trashCleaning ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    Clean Trash
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden">
            <div className="w-full px-8 py-8">
              {trashError && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:bg-red-950/40 dark:border-red-900/60">
                  {trashError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
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
                            disabled={trashCleaning || trashDeleting}
                            className={`px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-900/30 ${
                              trashCleaning || trashDeleting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeleteTrashFolder(folder)}
                            disabled={trashCleaning || trashDeleting}
                            className={`px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-900/30 ${
                              trashCleaning || trashDeleting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
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
                            {file.filename || 'File'}
                          </div>
                          <div className="text-xs text-slate-400">
                            Dihapus {new Date(file.deletedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestoreTrashFile(file)}
                            disabled={trashCleaning || trashDeleting}
                            className={`px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-900/30 ${
                              trashCleaning || trashDeleting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeleteTrashFile(file)}
                            disabled={trashCleaning || trashDeleting}
                            className={`px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-900/30 ${
                              trashCleaning || trashDeleting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
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
      </div>
      {trashCleaning && (
        <div className="fixed inset-0 z-40 bg-white/80 dark:bg-[#202225]/80 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-200">
            <span className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent animate-spin dark:border-slate-500" />
            Menghapus semua data di Trash...
          </div>
        </div>
      )}
      {trashConfirmOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Clean Trash</div>
              <button
                onClick={() => setTrashConfirmOpen(false)}
                disabled={trashCleaning}
                className={`text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  trashCleaning ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div className="px-6 py-6">
              <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
                Semua file dan folder di Trash akan dihapus permanen. Aksi ini tidak bisa dibatalkan.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setTrashConfirmOpen(false)}
                  disabled={trashCleaning}
                  className={`flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    trashCleaning ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCleanTrash}
                  disabled={trashCleaning}
                  className={`flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-sm font-medium text-white hover:bg-rose-500 transition shadow-sm ${
                    trashCleaning ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{deleteTitle}</div>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={trashDeleting}
                className={`text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  trashDeleting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div className="px-6 py-6">
              <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{deleteDescription}</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={trashDeleting}
                  className={`flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    trashDeleting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={trashDeleting}
                  className={`flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-sm font-medium text-white hover:bg-rose-500 transition shadow-sm ${
                    trashDeleting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {trashCleaning && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[110]">
          <div className="w-full sm:w-[360px] bg-white border border-slate-200 rounded-2xl shadow-2xl dark:bg-[#202225] dark:border-slate-700">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent animate-spin dark:border-slate-500" />
              <div className="text-sm text-slate-700 dark:text-slate-200">Menghapus semua data di Trash...</div>
            </div>
          </div>
        </div>
      )}
      {trashToast && (
        <div className="fixed top-4 right-4 z-[110] max-w-sm text-sm rounded-xl px-3 py-2 shadow-lg border">
          <div
            className={
              trashToast.type === 'success'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300'
                : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300'
            }
          >
            {trashToast.message}
          </div>
        </div>
      )}
    </div>
  )
}

export default Trash
