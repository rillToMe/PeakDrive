import { useCallback } from 'react'
import { uploadFile } from '../services/driveService.js'

const useUpload = ({ folderId, onUploaded, setError }) => {
  const handleUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      setError('')
      try {
        await uploadFile(file, folderId)
        await onUploaded(folderId)
      } catch (err) {
        setError(err.message || 'Gagal upload file.')
      } finally {
        event.target.value = ''
      }
    },
    [folderId, onUploaded, setError]
  )

  return { handleUpload }
}

export default useUpload
