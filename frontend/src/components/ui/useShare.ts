import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFolderShare, createShare } from '../../services/driveService'
import { getSharePlatforms } from './sharePlatforms'
import type { SharePlatform } from './sharePlatforms'
import type { FileItem, FolderItem } from '../../types'
import type { ShareTarget } from './shareSheetContext'

interface ResolvedTarget {
  item: FileItem | FolderItem
  type: 'file' | 'folder'
}

const resolveShareTarget = (payload: ShareTarget | null): ResolvedTarget | null => {
  if (!payload) return null
  if ('item' in payload && 'type' in payload) {
    return { item: payload.item, type: payload.type }
  }
  const item = payload as FileItem | FolderItem
  const fileItem = item as FileItem
  const isFile = Boolean(fileItem.fileType || fileItem.filename || fileItem.originalName)
  const type: 'file' | 'folder' = (item as { type?: string }).type === 'folder' ? 'folder' : isFile ? 'file' : 'folder'
  return { item, type }
}

export interface UseShareSheetResult {
  sheetOpen: boolean
  shareUrl: string
  loading: boolean
  error: string
  toast: string
  copySuccess: boolean
  platforms: SharePlatform[]
  openShare: (payload: ShareTarget) => Promise<void>
  closeSheet: () => void
  handleCopy: () => Promise<void>
}

const useShare = (): UseShareSheetResult => {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const targetRef = useRef<ResolvedTarget | null>(null)

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
    setShareUrl('')
    setLoading(false)
    setError('')
    setCopySuccess(false)
    targetRef.current = null
  }, [])

  useEffect(() => {
    if (!sheetOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSheet()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSheet, sheetOpen])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!copySuccess) return
    const timer = setTimeout(() => setCopySuccess(false), 2000)
    return () => clearTimeout(timer)
  }, [copySuccess])

  const openShare = useCallback(async (payload: ShareTarget) => {
    const resolved = resolveShareTarget(payload)
    if (!resolved?.item?.publicId) return
    targetRef.current = resolved
    setSheetOpen(true)
    setShareUrl('')
    setError('')
    setCopySuccess(false)
    setLoading(true)
    try {
      const data =
        resolved.type === 'folder'
          ? await createFolderShare(resolved.item.publicId)
          : await createShare(resolved.item.publicId)
      const base = window.location.origin
      const url =
        data?.token && resolved.type === 'folder'
          ? `${base}/s/folder/${data.token}`
          : data?.token
            ? `${base}/s/file/${data.token}`
            : data?.url
      if (!url) {
        throw new Error('Gagal membuat link share.')
      }
      setShareUrl(url)
    } catch (err) {
      setError((err as Error)?.message || 'Gagal membuat link share.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setToast('Link berhasil disalin')
      setCopySuccess(true)
    } catch (err) {
      setError((err as Error)?.message || 'Gagal menyalin link.')
    }
  }

  const platforms = useMemo(() => getSharePlatforms(shareUrl), [shareUrl])

  return {
    sheetOpen,
    shareUrl,
    loading,
    error,
    toast,
    copySuccess,
    platforms,
    openShare,
    closeSheet,
    handleCopy
  }
}

export default useShare
