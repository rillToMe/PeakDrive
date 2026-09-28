import axios from 'axios'
import { getToken } from '../lib/api'

export const uploadFileWithProgress = async (
  file: File,
  folderPublicId: string | null,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<unknown> => {
  try {
    const form = new FormData()
    form.append('file', file)
    const token = getToken()
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const shouldAttachFolder = folderPublicId && folderPublicId !== 'root'
    const target = shouldAttachFolder
      ? `/api/files/upload?folderPublicId=${folderPublicId}`
      : '/api/files/upload'
    const response = await axios.post(target, form, {
      headers,
      signal,
      onUploadProgress: (event) => {
        if (!event.total) return
        const progress = Math.round((event.loaded * 100) / event.total)
        onProgress?.(progress)
      }
    })
    return response.data
  } catch (err) {
    if (axios.isCancel?.(err) || (err as { code?: string })?.code === 'ERR_CANCELED') {
      throw err
    }
    const axiosErr = err as {
      response?: { data?: { message?: string } | string }
      message?: string
    }
    const responseData = axiosErr?.response?.data
    const message =
      (typeof responseData === 'object' ? responseData?.message : responseData) ||
      axiosErr?.message
    throw new Error(message || 'Gagal upload file.')
  }
}
