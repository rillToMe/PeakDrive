import { createContext, useContext } from 'react'
import type { DuplicatePayload } from '../../types'

export interface DuplicateUploadConfirmContextValue {
  confirmDuplicateUpload: (payload: DuplicatePayload) => Promise<boolean>
}

export const DuplicateUploadConfirmContext = createContext<DuplicateUploadConfirmContextValue>({
  confirmDuplicateUpload: async () => true
})

export const useDuplicateUploadConfirm = (): DuplicateUploadConfirmContextValue =>
  useContext(DuplicateUploadConfirmContext)
