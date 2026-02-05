import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UploadQueueContext } from './useUploadQueue.js'
import { getUniqueFileName } from '../services/driveUtils.js'
import { uploadFileWithProgress } from '../services/uploadService.js'

export const UploadQueueProvider = ({ children }) => {
  const [uploads, setUploads] = useState([])
  const [lastAddedId, setLastAddedId] = useState(null)
  const configRef = useRef({ folderId: null, onUploaded: null, setError: null, existingFileNames: [] })
  const controllersRef = useRef(new Map())
  const clearTimerRef = useRef(null)

  const setConfig = useCallback((config) => {
    configRef.current = { ...configRef.current, ...config }
  }, [])

  const updateUpload = useCallback((id, patch) => {
    setUploads((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const startUpload = useCallback(
    async (file) => {
      if (!file) return
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
      const { folderId, onUploaded, setError } = configRef.current
      if (setError) {
        setError('')
      }
      try {
        await uploadFileWithProgress(
          file,
          folderId,
          (progress) => {
            const elapsed = (Date.now() - startedAt) / 1000
            const remaining = progress > 0 ? (elapsed * (100 - progress)) / progress : null
            updateUpload(id, { progress, estimateSeconds: Number.isFinite(remaining) ? remaining : null })
          },
          controller.signal
        )
        updateUpload(id, { progress: 100, status: 'done', finishedAt: Date.now(), estimateSeconds: null })
        if (onUploaded) {
          await onUploaded(folderId)
        }
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
      }
    },
    [updateUpload]
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
    (event) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return
      const existingNames = new Set(
        (configRef.current.existingFileNames || []).map((name) => name.trim().toLowerCase())
      )
      files.forEach((file) => {
        const uniqueName = getUniqueFileName(file.name, Array.from(existingNames))
        existingNames.add(uniqueName.toLowerCase())
        const finalFile =
          uniqueName !== file.name
            ? new File([file], uniqueName, { type: file.type, lastModified: file.lastModified })
            : file
        startUpload(finalFile)
      })
      event.target.value = ''
    },
    [startUpload]
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
      setConfig
    }),
    [uploads, lastAddedId, startUpload, cancelUpload, handleUpload, setConfig]
  )

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>
}
