import { useCallback } from 'react'
import type { ChangeEvent } from 'react'
import { uploadFile } from '../services/driveService'

interface UseUploadParams {
  folderId: string | null
  onUploaded: (folderId: string) => void | Promise<void>
  setError: (message: string) => void
}

interface UseUploadResult {
  handleUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
}

const useUpload = ({ folderId, onUploaded, setError }: UseUploadParams): UseUploadResult => {
  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setError('')
      try {
        await uploadFile(file, folderId)
        await onUploaded(folderId as string)
      } catch (err) {
        setError((err as Error).message || 'Gagal upload file.')
      } finally {
        event.target.value = ''
      }
    },
    [folderId, onUploaded, setError]
  )

  return { handleUpload }
}

export default useUpload
