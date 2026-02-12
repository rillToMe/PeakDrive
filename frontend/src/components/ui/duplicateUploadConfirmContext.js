import { createContext, useContext } from 'react'

export const DuplicateUploadConfirmContext = createContext({
  confirmDuplicateUpload: async () => true
})

export const useDuplicateUploadConfirm = () => useContext(DuplicateUploadConfirmContext)
