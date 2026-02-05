import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Drive from './pages/Drive.jsx'
import ShareView from './pages/ShareView.jsx'
import Admin from './pages/Admin.jsx'
import { UploadQueueProvider } from './hooks/UploadQueueProvider.jsx'
import UploadToastPanel from './components/upload/UploadToastPanel.jsx'

const hasToken = () => Boolean(localStorage.getItem('token'))

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
  return (
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
  )
}

export default App
