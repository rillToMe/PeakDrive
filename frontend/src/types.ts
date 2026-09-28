export type UserRole = 'User' | 'Admin' | 'MasterAdmin'

export interface AuthUser {
  id: number
  email: string
  role: UserRole
}

export interface StoredUser {
  id?: number
  email?: string
  role?: UserRole | string
}

export interface FolderItem {
  publicId: string
  name: string
  parentPublicId?: string | null
  createdAt?: string
}

export interface FileItem {
  publicId: string
  filename?: string
  originalName?: string
  name?: string
  fileType?: string
  size?: number
  uploadedAt?: string
  createdAt?: string
  updatedAt?: string
  thumbnailName?: string | null
  dpi?: string | number
  bitDepth?: string | number
  metadata?: { dpi?: string | number; bitDepth?: string | number }
  meta?: { dpi?: string | number; bitDepth?: string | number }
  /** Populated for locally synthesized preview targets. */
  deletedAt?: string
}

export interface FolderListing {
  folder?: FolderItem | null
  folders: FolderItem[]
  files: FileItem[]
}

export interface PathItem {
  publicId: string
  name: string
}

export interface PreviewEntry {
  url: string
  type: string
}

export type PreviewMap = Record<string, PreviewEntry>

export interface ShareResult {
  token?: string
  url?: string
}

export interface StorageUsage {
  totalBytes: number
}

export interface ActivityLogItem {
  id: number
  userId?: number | null
  userEmail?: string | null
  action: string
  status: string
  message: string
  createdAt: string
}

export interface AdminUser {
  id: number
  email: string
  role: UserRole
  createdAt: string
}

export interface TrashFile {
  publicId: string
  filename: string
  fileType: string
  size: number
  uploadedAt: string
  folderPublicId?: string | null
  deletedAt: string
}

export interface TrashFolder {
  publicId: string
  name: string
  parentPublicId?: string | null
  createdAt: string
  deletedAt: string
}

export interface TrashListing {
  folders: TrashFolder[]
  files: TrashFile[]
}

export interface SavedFileTarget {
  publicId: string
  filename: string
  fileType: string
  size: number
  uploadedAt: string
}

export interface SavedFolderTarget {
  publicId: string
  name: string
  createdAt: string
}

export interface SavedItem {
  id: number
  targetType: 'file' | 'folder'
  targetId: number
  savedAt: string
  available: boolean
  file?: SavedFileTarget | null
  folder?: SavedFolderTarget | null
}

export interface SavedListResponse {
  items: SavedItem[]
  total: number
}

export interface SavedStatusResponse {
  saved: boolean
}

export type UploadStatus = 'uploading' | 'done' | 'error' | 'canceled'

export interface UploadTask {
  id: string
  filename: string
  progress: number
  status: UploadStatus
  startedAt: number
  estimateSeconds: number | null
  finishedAt?: number
}

export type DroppedEntryType = 'file' | 'folder'

export interface DroppedEntry {
  type: DroppedEntryType
  name: string
  file?: File
  relativePath?: string
  children?: DroppedEntry[]
}

export interface DroppedEntriesResult {
  supportsFolders: boolean
  entries: DroppedEntry[]
}

export interface DuplicatePayload {
  type: 'file' | 'folder'
  name: string
  suggestedName: string
}

export interface SelectedItems {
  files: string[]
  folders: string[]
}
