import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Drive from './pages/Drive.jsx'
import ShareView from './pages/ShareView.jsx'
import Admin from './pages/Admin.jsx'
import { UploadQueueProvider } from './hooks/UploadQueueProvider.jsx'
import UploadToastPanel from './components/upload/UploadToastPanel.jsx'
import DuplicateUploadConfirmProvider from './components/ui/DuplicateUploadConfirmProvider.jsx'

const hasToken = () => Boolean(localStorage.getItem('token'))
const THEME_KEY = 'peakdrive-theme'

const getStoredTheme = () => localStorage.getItem(THEME_KEY) || 'device'

const resolveTheme = (theme) => {
  if (theme === 'device') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

const applyTheme = (theme) => {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = theme
}

const ProtectedRoute = ({ children }) => {
  if (!hasToken()) {
    return <Navigate to="/login" replace />
  }
  return children
}

const PublicOnlyRoute = ({ children }) => {
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
          <Route path="/s/file/:token" element={<ShareView />} />
          <Route path="/s/folder/:token" element={<ShareView />} />
          <Route path="/s/:token" element={<ShareView />} />
          <Route path="*" element={<Navigate to="/drive" replace />} />
        </Routes>
        <UploadToastPanel />
      </UploadQueueProvider>
    </DuplicateUploadConfirmProvider>
  )
}

export default App
