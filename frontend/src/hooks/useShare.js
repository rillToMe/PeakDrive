import { useState } from 'react'
import { createFolderShare, createShare } from '../services/driveService.js'

const useShare = (setError) => {
  const [shareUrl, setShareUrl] = useState('')
  const [copiedFileId, setCopiedFileId] = useState(null)
  const [copiedFolderId, setCopiedFolderId] = useState(null)

  const handleShareCopy = async (fileId) => {
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
      setError(err.message || 'Gagal membuat share link.')
    }
  }

  const handleFolderShareCopy = async (folderId) => {
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
      setError(err.message || 'Gagal menyalin link folder.')
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
