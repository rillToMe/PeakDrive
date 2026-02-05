import { apiFetch } from '../lib/api.js'

export const getFolder = async (publicId) => {
  const response = await apiFetch(`/api/folders/${publicId}`)
  return response.json()
}

export const createFolder = async (name, parentPublicId) => {
  const response = await apiFetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentPublicId })
  })
  return response.json()
}

export const renameFolder = async (publicId, name) => {
  const response = await apiFetch(`/api/folders/${publicId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return response.json()
}

export const deleteFolder = async (publicId) => {
  await apiFetch(`/api/folders/delete/${publicId}`, { method: 'POST' })
}

export const deleteFile = async (publicId) => {
  await apiFetch(`/api/files/${publicId}`, { method: 'DELETE' })
}

export const uploadFile = async (file, folderPublicId) => {
  const form = new FormData()
  form.append('file', file)
  const shouldAttachFolder = folderPublicId && folderPublicId !== 'root'
  const target = shouldAttachFolder ? `/api/files/upload?folderPublicId=${folderPublicId}` : '/api/files/upload'
  const response = await apiFetch(target, { method: 'POST', body: form })
  return response.json()
}

export const downloadFileBlob = async (publicId) => {
  const response = await apiFetch(`/api/files/download/${publicId}`)
  return response.blob()
}

export const downloadFileWithMeta = async (publicId) => {
  const response = await apiFetch(`/api/files/download/${publicId}`)
  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  const disposition = response.headers.get('content-disposition') || ''
  const fileNameMatch = disposition.match(/filename="(.+)"/)
  const filename = fileNameMatch ? fileNameMatch[1] : `file-${publicId}`
  const blob = await response.blob()
  return { blob, filename, contentType }
}

export const downloadFolderBlob = async (publicId) => {
  const response = await apiFetch(`/api/folders/download-zip/${publicId}`)
  return response.blob()
}

export const viewFileBlob = async (publicId) => {
  const response = await apiFetch(`/api/files/view/${publicId}`)
  return response.blob()
}

export const createShare = async (filePublicId) => {
  const response = await apiFetch(`/api/share/${filePublicId}`, { method: 'POST' })
  return response.json()
}

export const createFolderShare = async (folderPublicId) => {
  const response = await apiFetch(`/api/share/folder/${folderPublicId}`, { method: 'POST' })
  return response.json()
}
