import { createContext, useContext } from 'react'
import type { FileItem, FolderItem } from '../../types'

export type ShareTarget = FileItem | FolderItem | { item: FileItem | FolderItem; type: 'file' | 'folder' }

export interface ShareSheetContextValue {
  openShare: (payload: ShareTarget) => void
}

export const ShareSheetContext = createContext<ShareSheetContextValue>({
  openShare: () => {}
})

export const useShareSheet = (): ShareSheetContextValue => useContext(ShareSheetContext)
