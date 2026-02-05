import { useEffect } from 'react'

const useTitle = (title) => {
  useEffect(() => {
    if (title) {
      document.title = title
    }
    return () => {
      document.title = 'PeakDrive'
    }
  }, [title])
}

export default useTitle
