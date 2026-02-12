import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UploadQueueContext } from './useUploadQueue.js'
import { getUniqueFileName } from '../services/driveUtils.js'
import { checkFolderExists, createFolder } from '../services/driveService.js'
import { uploadFileWithProgress } from '../services/uploadService.js'
import { useDuplicateUploadConfirm } from '../components/ui/duplicateUploadConfirmContext.js'

export const UploadQueueProvider = ({ children }) => {
  const [uploads, setUploads] = useState([])
  const [lastAddedId, setLastAddedId] = useState(null)
  const configRef = useRef({
    folderId: null,
    onAllUploaded: null,
    setError: null,
    setUploadNotice: null,
    existingFileNames: [],
    existingFolderNames: []
  })
  const controllersRef = useRef(new Map())
  const clearTimerRef = useRef(null)
  const activeCountRef = useRef(0)
  const batchDepthRef = useRef(0)
  const hasBatchUploadsRef = useRef(false)
  const { confirmDuplicateUpload } = useDuplicateUploadConfirm()

  const setConfig = useCallback((config) => {
    configRef.current = { ...configRef.current, ...config }
  }, [])

  const updateUpload = useCallback((id, patch) => {
    setUploads((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const triggerRefreshIfReady = useCallback(async () => {
    if (activeCountRef.current !== 0) return
    if (batchDepthRef.current !== 0) return
    if (!hasBatchUploadsRef.current) return
    hasBatchUploadsRef.current = false
    const { onAllUploaded, folderId } = configRef.current
    if (onAllUploaded) {
      await onAllUploaded(folderId)
    }
  }, [])

  const beginBatch = useCallback(() => {
    batchDepthRef.current += 1
  }, [])

  const endBatch = useCallback(() => {
    batchDepthRef.current = Math.max(0, batchDepthRef.current - 1)
    triggerRefreshIfReady()
  }, [triggerRefreshIfReady])

  const startUpload = useCallback(
    async (file, overrideFolderId = null) => {
      if (!file) return
      activeCountRef.current += 1
      hasBatchUploadsRef.current = true
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const startedAt = Date.now()
      setLastAddedId(id)
      setUploads((prev) => [
        {
          id,
          filename: file.name || file.filename || file.originalName || 'File',
          progress: 0,
          status: 'uploading',
          startedAt,
          estimateSeconds: null
        },
        ...prev
      ])
      const controller = new AbortController()
      controllersRef.current.set(id, controller)
      const { folderId, setError } = configRef.current
      const targetFolderId = overrideFolderId ?? folderId
      if (setError) {
        setError('')
      }
      try {
        await uploadFileWithProgress(
          file,
          targetFolderId,
          (progress) => {
            const elapsed = (Date.now() - startedAt) / 1000
            const remaining = progress > 0 ? (elapsed * (100 - progress)) / progress : null
            updateUpload(id, { progress, estimateSeconds: Number.isFinite(remaining) ? remaining : null })
          },
          controller.signal
        )
        updateUpload(id, { progress: 100, status: 'done', finishedAt: Date.now(), estimateSeconds: null })
      } catch (err) {
        const canceled = controller.signal.aborted || err?.code === 'ERR_CANCELED'
        if (canceled) {
          updateUpload(id, { status: 'canceled', finishedAt: Date.now(), estimateSeconds: null })
          return
        }
        updateUpload(id, { status: 'error', finishedAt: Date.now(), estimateSeconds: null })
        if (setError) {
          setError(err?.message || 'Gagal upload file.')
        }
      } finally {
        controllersRef.current.delete(id)
        activeCountRef.current = Math.max(0, activeCountRef.current - 1)
        await triggerRefreshIfReady()
      }
    },
    [triggerRefreshIfReady, updateUpload]
  )

  const cancelUpload = useCallback(
    (id) => {
      const controller = controllersRef.current.get(id)
      if (controller) {
        controller.abort()
      }
      updateUpload(id, { status: 'canceled', finishedAt: Date.now(), estimateSeconds: null })
    },
    [updateUpload]
  )

  const handleUpload = useCallback(
    async (event) => {
      const target = event.target
      const files = Array.from(target.files || [])
      if (files.length === 0) return
      const existingNames = new Set(
        (configRef.current.existingFileNames || []).map((name) => name.trim().toLowerCase())
      )
      beginBatch()
      try {
        for (const file of files) {
          const uniqueName = getUniqueFileName(file.name, Array.from(existingNames))
          if (uniqueName !== file.name) {
            const confirmed = await confirmDuplicateUpload({
              type: 'file',
              name: file.name,
              suggestedName: uniqueName
            })
            if (!confirmed) {
              continue
            }
          }
          existingNames.add(uniqueName.toLowerCase())
          const finalFile =
            uniqueName !== file.name
              ? new File([file], uniqueName, { type: file.type, lastModified: file.lastModified })
              : file
          startUpload(finalFile)
        }
      } finally {
        endBatch()
        target.value = ''
      }
    },
    [beginBatch, confirmDuplicateUpload, endBatch, startUpload]
  )

  const handleDropUpload = useCallback(
    async ({ targetFolderId, entries, supportsFolders }) => {
      const { setError, setUploadNotice, existingFileNames, existingFolderNames } = configRef.current
      if (!supportsFolders && setError) {
        setError('Folder drag & drop tidak didukung di browser ini.')
      }
      if (!entries || entries.length === 0) return

      const normalize = (value) => value.trim().toLowerCase()
      const folderCache = new WeakMap()
      const fileNamePools = new Map()
      const folderNamePools = new Map()

      const targetFilePool = new Set((existingFileNames || []).map((name) => normalize(name)))
      fileNamePools.set(targetFolderId, targetFilePool)

      const targetFolderPool = new Set((existingFolderNames || []).map((name) => normalize(name)))
      folderNamePools.set(targetFolderId, targetFolderPool)

      const getFilePool = (parentId) => {
        const existing = fileNamePools.get(parentId)
        if (existing) return existing
        const next = new Set()
        fileNamePools.set(parentId, next)
        return next
      }

      const getFolderPool = (parentId) => {
        const existing = folderNamePools.get(parentId)
        if (existing) return existing
        const next = new Set()
        folderNamePools.set(parentId, next)
        return next
      }

      const resolveUniqueFolderName = async (name, parentId) => {
        const pool = getFolderPool(parentId)
        const safeName = name?.trim() || 'New Folder'
        let index = 0
        let candidate = safeName
        const parentPublicId = parentId === 'root' ? null : parentId
        while (true) {
          if (pool.has(normalize(candidate))) {
            index += 1
            candidate = `${safeName} (${index})`
            continue
          }
          const { exists } = await checkFolderExists(candidate, parentPublicId)
          if (!exists) break
          index += 1
          candidate = `${safeName} (${index})`
        }
        if (candidate !== safeName) {
          const confirmed = await confirmDuplicateUpload({
            type: 'folder',
            name: safeName,
            suggestedName: candidate
          })
          if (!confirmed) {
            return null
          }
        }
        pool.add(normalize(candidate))
        return candidate
      }

      const ensureFolder = async (entry, parentId) => {
        const cached = folderCache.get(entry)
        if (cached) return cached
        const finalName = await resolveUniqueFolderName(entry.name, parentId)
        if (!finalName) return null
        const created = await createFolder(finalName, parentId === 'root' ? null : parentId)
        folderCache.set(entry, created.publicId)
        return created.publicId
      }

      const uploadFileEntry = async (file, parentId, nameOverride) => {
        if (!file) return
        const pool = getFilePool(parentId)
        const name = nameOverride || file.name
        const uniqueName = getUniqueFileName(name, Array.from(pool))
        if (uniqueName !== name) {
          const confirmed = await confirmDuplicateUpload({
            type: 'file',
            name,
            suggestedName: uniqueName
          })
          if (!confirmed) return
        }
        pool.add(uniqueName.toLowerCase())
        const finalFile =
          uniqueName !== file.name
            ? new File([file], uniqueName, { type: file.type, lastModified: file.lastModified })
            : file
        startUpload(finalFile, parentId)
      }

      const uploadEntry = async (entry, parentId) => {
        if (entry.type === 'file') {
          await uploadFileEntry(entry.file, parentId, entry.name)
          return
        }
        if (entry.type === 'folder') {
          if (setUploadNotice) {
            setUploadNotice(`Mengupload folder: ${entry.name}`)
          }
          const folderId = await ensureFolder(entry, parentId)
          if (!folderId) return
          await Promise.all((entry.children || []).map((child) => uploadEntry(child, folderId)))
        }
      }

      beginBatch()
      try {
        await Promise.all(entries.map((entry) => uploadEntry(entry, targetFolderId)))
      } finally {
        endBatch()
      }
    },
    [beginBatch, confirmDuplicateUpload, endBatch, startUpload]
  )

  useEffect(() => {
    if (uploads.length === 0) return
    const allDone = uploads.every((item) => item.status !== 'uploading')
    if (!allDone) {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
      return
    }
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current)
    }
    clearTimerRef.current = setTimeout(() => {
      setUploads([])
    }, 4000)
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
      }
    }
  }, [uploads])

  const value = useMemo(
    () => ({
      uploads,
      lastAddedId,
      startUpload,
      cancelUpload,
      handleUpload,
      handleDropUpload,
      setConfig,
      beginBatch,
      endBatch
    }),
    [
      uploads,
      lastAddedId,
      startUpload,
      cancelUpload,
      handleUpload,
      handleDropUpload,
      setConfig,
      beginBatch,
      endBatch
    ]
  )

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>
}
