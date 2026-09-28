import { apiFetch } from '../lib/api'
import type {
  ActivityLogItem,
  FolderItem,
  FolderListing,
  SavedListResponse,
  SavedStatusResponse,
  ShareResult,
  StorageUsage,
  TrashListing
} from '../types'

export const getFolder = async (publicId: string): Promise<FolderListing> => {
  const response = await apiFetch(`/api/folders/${publicId}`)
  return response.json()
}

export const createFolder = async (
  name: string,
  parentPublicId: string | null
): Promise<FolderItem> => {
  const response = await apiFetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentPublicId })
  })
  return response.json()
}

export const checkFolderExists = async (
  name: string,
  parentPublicId: string | null
): Promise<{ exists: boolean }> => {
  const target = parentPublicId
    ? `/api/folders/exists?name=${encodeURIComponent(name)}&parentPublicId=${parentPublicId}`
    : `/api/folders/exists?name=${encodeURIComponent(name)}`
  const response = await apiFetch(target)
  return response.json()
}

export const renameFolder = async (publicId: string, name: string): Promise<FolderItem> => {
  const response = await apiFetch(`/api/folders/${publicId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return response.json()
}

export const renameFile = async (
  publicId: string,
  name: string
): Promise<{ publicId: string; filename: string }> => {
  const response = await apiFetch(`/api/files/${publicId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return response.json()
}

export const deleteFolder = async (publicId: string): Promise<void> => {
  await apiFetch(`/api/folders/delete/${publicId}`, { method: 'POST' })
}

export const deleteFile = async (publicId: string): Promise<void> => {
  await apiFetch(`/api/files/${publicId}`, { method: 'DELETE' })
}

export const uploadFile = async (file: File, folderPublicId: string | null): Promise<unknown> => {
  const form = new FormData()
  form.append('file', file)
  const shouldAttachFolder = folderPublicId && folderPublicId !== 'root'
  const target = shouldAttachFolder
    ? `/api/files/upload?folderPublicId=${folderPublicId}`
    : '/api/files/upload'
  const response = await apiFetch(target, { method: 'POST', body: form })
  return response.json()
}

export const downloadFileBlob = async (publicId: string): Promise<Blob> => {
  const response = await apiFetch(`/api/files/download/${publicId}`)
  return response.blob()
}

export const downloadFileWithMeta = async (
  publicId: string
): Promise<{ blob: Blob; filename: string; contentType: string }> => {
  const response = await apiFetch(`/api/files/download/${publicId}`)
  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  const disposition = response.headers.get('content-disposition') || ''
  const fileNameMatch = disposition.match(/filename="(.+)"/)
  const filename = fileNameMatch ? fileNameMatch[1] : `file-${publicId}`
  const blob = await response.blob()
  return { blob, filename, contentType }
}

export const downloadFolderBlob = async (publicId: string): Promise<Blob> => {
  const response = await apiFetch(`/api/folders/download-zip/${publicId}`)
  return response.blob()
}

export const viewFileBlob = async (publicId: string): Promise<Blob> => {
  const response = await apiFetch(`/api/files/view/${publicId}`)
  return response.blob()
}

export const viewFileThumbnailBlob = async (publicId: string): Promise<Blob> => {
  const response = await apiFetch(`/api/files/thumbnail/${publicId}`)
  return response.blob()
}

export const getStorageUsage = async (): Promise<StorageUsage> => {
  const response = await apiFetch('/api/files/usage')
  return response.json()
}

export const createShare = async (filePublicId: string): Promise<ShareResult> => {
  const response = await apiFetch(`/api/share/${filePublicId}`, { method: 'POST' })
  return response.json()
}

export const createFolderShare = async (folderPublicId: string): Promise<ShareResult> => {
  const response = await apiFetch(`/api/share/folder/${folderPublicId}`, { method: 'POST' })
  return response.json()
}

export const getTrash = async (): Promise<TrashListing> => {
  const response = await apiFetch('/api/trash')
  return response.json()
}

export const restoreTrashFile = async (publicId: string): Promise<unknown> => {
  const response = await apiFetch(`/api/trash/restore/file/${publicId}`, { method: 'POST' })
  return response.json()
}

export const restoreTrashFolder = async (publicId: string): Promise<unknown> => {
  const response = await apiFetch(`/api/trash/restore/folder/${publicId}`, { method: 'POST' })
  return response.json()
}

export const deleteTrashFilePermanently = async (publicId: string): Promise<void> => {
  await apiFetch(`/api/trash/file/${publicId}`, { method: 'DELETE' })
}

export const deleteTrashFolderPermanently = async (publicId: string): Promise<void> => {
  await apiFetch(`/api/trash/folder/${publicId}`, { method: 'DELETE' })
}

export const cleanTrash = async (): Promise<unknown> => {
  const response = await apiFetch('/api/trash/clean', { method: 'DELETE' })
  return response.json()
}

export const getActivityLogs = async (take?: number): Promise<ActivityLogItem[]> => {
  const target = Number.isFinite(take)
    ? `/api/admin/activity-logs?take=${take}`
    : '/api/admin/activity-logs'
  const response = await apiFetch(target)
  return response.json()
}

export const getSavedItems = async (
  page = 1,
  pageSize = 30
): Promise<SavedListResponse> => {
  const response = await apiFetch(`/api/saved?page=${page}&pageSize=${pageSize}`)
  return response.json()
}

export const getSavedStatus = async (
  targetType: 'file' | 'folder',
  publicId: string
): Promise<SavedStatusResponse> => {
  const response = await apiFetch(
    `/api/saved/check?targetType=${targetType}&publicId=${encodeURIComponent(publicId)}`
  )
  return response.json()
}

export const saveItem = async (
  targetType: 'file' | 'folder',
  publicId: string
): Promise<number> => {
  const response = await apiFetch('/api/saved', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType, publicId })
  })
  return response.json()
}

export const removeSavedItem = async (id: number): Promise<void> => {
  await apiFetch(`/api/saved/${id}`, { method: 'DELETE' })
}
