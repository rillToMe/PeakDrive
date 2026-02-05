import axios from 'axios'
import { getToken } from '../lib/api.js'

export const uploadFileWithProgress = async (file, folderPublicId, onProgress, signal) => {
  try {
    const form = new FormData()
    form.append('file', file)
    const token = getToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const shouldAttachFolder = folderPublicId && folderPublicId !== 'root'
    const target = shouldAttachFolder ? `/api/files/upload?folderPublicId=${folderPublicId}` : '/api/files/upload'
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
    if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') {
      throw err
    }
    const message = err?.response?.data?.message || err?.response?.data || err?.message
    throw new Error(message || 'Gagal upload file.')
  }
}
