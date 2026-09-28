import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Drive from './pages/Drive'
import ShareView from './pages/ShareView'
import Admin from './pages/Admin'
import Trash from './pages/Trash'
import { UploadQueueProvider } from './hooks/UploadQueueProvider'
import UploadToastPanel from './components/upload/UploadToastPanel'
import DuplicateUploadConfirmProvider from './components/ui/DuplicateUploadConfirmProvider'
import ShareSheetProvider from './components/ui/ShareSheetProvider'

const hasToken = (): boolean => Boolean(localStorage.getItem('token'))
const THEME_KEY = 'peakdrive-theme'

const getStoredTheme = (): string => localStorage.getItem(THEME_KEY) || 'device'

const resolveTheme = (theme: string): string => {
  if (theme === 'device') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

const applyTheme = (theme: string): void => {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = theme
}

interface RouteWrapperProps {
  children: ReactNode
}

const ProtectedRoute = ({ children }: RouteWrapperProps) => {
  if (!hasToken()) {
    return <Navigate to="/login" replace />
  }
  return children
}

const PublicOnlyRoute = ({ children }: RouteWrapperProps) => {
  if (hasToken()) {
    return <Navigate to="/drive" replace />
  }
  return children
}

function App() {
  const [theme, setTheme] = useState(getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleUpdate = () => setTheme(getStoredTheme())
    media.addEventListener('change', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('theme-change', handleUpdate)
    return () => {
      media.removeEventListener('change', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('theme-change', handleUpdate)
    }
  }, [])

  return (
    <DuplicateUploadConfirmProvider>
      <ShareSheetProvider>
        <UploadQueueProvider>
          <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/drive"
            element={
              <ProtectedRoute>
                <Drive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/drive/folders/:folderPublicId"
            element={
              <ProtectedRoute>
                <Drive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/drive/files/:filePublicId"
            element={
              <ProtectedRoute>
                <Drive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trash"
            element={
              <ProtectedRoute>
                <Trash />
              </ProtectedRoute>
            }
          />
          <Route path="/s/file/:token" element={<ShareView />} />
          <Route path="/s/folder/:token" element={<ShareView />} />
          <Route path="/s/:token" element={<ShareView />} />
          <Route path="*" element={<Navigate to="/drive" replace />} />
          </Routes>
          <UploadToastPanel />
        </UploadQueueProvider>
      </ShareSheetProvider>
    </DuplicateUploadConfirmProvider>
  )
}

export default App
