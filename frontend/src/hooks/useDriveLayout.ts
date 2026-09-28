import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export type ThemeMode = 'light' | 'dark' | 'device'

export interface SidebarActions {
  onCreateFolder: (() => void) | null
  storageLabel: string
  createFolderDisabled: boolean
}

export interface DriveLayoutContextValue {
  sidebarOpen: boolean
  setSidebarOpen: Dispatch<SetStateAction<boolean>>
  setSidebarActions: Dispatch<SetStateAction<SidebarActions>>
}

export const DriveLayoutContext = createContext<DriveLayoutContextValue | null>(null)

const useDriveLayout = (): DriveLayoutContextValue | null => {
  return useContext(DriveLayoutContext)
}

export default useDriveLayout
