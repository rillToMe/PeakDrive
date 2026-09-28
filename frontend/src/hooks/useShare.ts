import { useState } from 'react'
import { createFolderShare, createShare } from '../services/driveService'

interface UseShareResult {
  shareUrl: string
  copiedFileId: string | null
  copiedFolderId: string | null
  handleShareCopy: (fileId: string) => Promise<void>
  handleFolderShareCopy: (folderId: string) => Promise<void>
  setShareUrl: React.Dispatch<React.SetStateAction<string>>
}

const useShare = (setError: (message: string) => void): UseShareResult => {
  const [shareUrl, setShareUrl] = useState('')
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null)
  const [copiedFolderId, setCopiedFolderId] = useState<string | null>(null)

  const handleShareCopy = async (fileId: string) => {
    setError('')
    try {
      const data = await createShare(fileId)
      const url = data?.token ? `${window.location.origin}/s/file/${data.token}` : data?.url
      if (url) {
        await navigator.clipboard.writeText(url)
        setShareUrl(url)
        setCopiedFileId(fileId)
        setTimeout(() => setCopiedFileId(null), 1500)
      }
    } catch (err) {
      setError((err as Error).message || 'Gagal membuat share link.')
    }
  }

  const handleFolderShareCopy = async (folderId: string) => {
    setError('')
    try {
      const data = await createFolderShare(folderId)
      const url = data?.token ? `${window.location.origin}/s/folder/${data.token}` : data?.url
      if (!url) return
      await navigator.clipboard.writeText(url)
      setShareUrl(url)
      setCopiedFolderId(folderId)
      setTimeout(() => setCopiedFolderId(null), 1500)
    } catch (err) {
      setError((err as Error).message || 'Gagal menyalin link folder.')
    }
  }

  return {
    shareUrl,
    copiedFileId,
    copiedFolderId,
    handleShareCopy,
    handleFolderShareCopy,
    setShareUrl
  }
}

export default useShare
