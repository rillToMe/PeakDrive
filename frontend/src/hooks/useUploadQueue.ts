import { createContext, useContext } from 'react'
import type { ChangeEvent } from 'react'
import type { DroppedEntry, UploadTask } from '../types'

export interface UploadQueueConfig {
  folderId: string | null
  onAllUploaded: ((folderId: string) => void | Promise<void>) | null
  setError: ((message: string) => void) | null
  setUploadNotice: ((message: string) => void) | null
  existingFileNames: string[]
  existingFolderNames: string[]
}

export interface DropUploadPayload {
  targetFolderId: string
  entries: DroppedEntry[]
  supportsFolders: boolean
}

export interface UploadQueueContextValue {
  uploads: UploadTask[]
  lastAddedId: string | null
  startUpload: (file: File, overrideFolderId?: string | null) => Promise<void>
  cancelUpload: (id: string) => void
  handleUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  handleDropUpload: (payload: DropUploadPayload) => Promise<void>
  setConfig: (config: Partial<UploadQueueConfig>) => void
  beginBatch: () => void
  endBatch: () => void
}

export const UploadQueueContext = createContext<UploadQueueContextValue | null>(null)

const emptyContext: UploadQueueContextValue = {
  uploads: [],
  lastAddedId: null,
  startUpload: async () => {},
  cancelUpload: () => {},
  handleUpload: async () => {},
  handleDropUpload: async () => {},
  setConfig: () => {},
  beginBatch: () => {},
  endBatch: () => {}
}

const useUploadQueue = (): UploadQueueContextValue => {
  return useContext(UploadQueueContext) || emptyContext
}

export default useUploadQueue
