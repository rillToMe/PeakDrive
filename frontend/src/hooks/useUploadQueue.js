import { createContext, useContext } from 'react'

export const UploadQueueContext = createContext(null)

const emptyContext = {
  uploads: [],
  lastAddedId: null,
  startUpload: () => {},
  cancelUpload: () => {},
  handleUpload: () => {},
  setConfig: () => {},
  beginBatch: () => {},
  endBatch: () => {}
}

const useUploadQueue = () => {
  return useContext(UploadQueueContext) || emptyContext
}

export default useUploadQueue
