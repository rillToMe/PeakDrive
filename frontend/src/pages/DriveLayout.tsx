import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import DriveSidebar from '../components/drive/DriveSidebar'
import { DriveLayoutContext } from '../hooks/useDriveLayout'
import type { SidebarActions } from '../hooks/useDriveLayout'

interface ShootingStar {
  id: string
  left: number
  top: number
  delay: number
  duration: number
  size: number
  opacity: number
}

const DriveLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarActions, setSidebarActions] = useState<SidebarActions>({
    onCreateFolder: null,
    storageLabel: '',
    createFolderDisabled: false
  })
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('peakdrive-theme') || 'device')
  const [shootingStarsEnabled, setShootingStarsEnabled] = useState(
    () => localStorage.getItem('peakdrive-exp-shooting-stars') === 'true'
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleThemeUpdate = () => setThemeMode(localStorage.getItem('peakdrive-theme') || 'device')
    media.addEventListener('change', handleThemeUpdate)
    window.addEventListener('storage', handleThemeUpdate)
    window.addEventListener('theme-change', handleThemeUpdate)
    return () => {
      media.removeEventListener('change', handleThemeUpdate)
      window.removeEventListener('storage', handleThemeUpdate)
      window.removeEventListener('theme-change', handleThemeUpdate)
    }
  }, [])

  useEffect(() => {
    const handleExperimentalUpdate = () => {
      setShootingStarsEnabled(localStorage.getItem('peakdrive-exp-shooting-stars') === 'true')
    }
    window.addEventListener('storage', handleExperimentalUpdate)
    window.addEventListener('experiment-change', handleExperimentalUpdate)
    return () => {
      window.removeEventListener('storage', handleExperimentalUpdate)
      window.removeEventListener('experiment-change', handleExperimentalUpdate)
    }
  }, [])

  const resolvedTheme = useMemo(() => {
    if (themeMode === 'device') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeMode
  }, [themeMode])

  const showShootingStars = resolvedTheme === 'dark' && shootingStarsEnabled
  const stars = useMemo<ShootingStar[]>(
    () => [
      { id: 'star-1', left: 8, top: -12, delay: 1.5, duration: 7.5, size: 1.6, opacity: 0.7 },
      { id: 'star-2', left: 22, top: -18, delay: 4.2, duration: 8.4, size: 1.2, opacity: 0.6 },
      { id: 'star-3', left: 36, top: -8, delay: 9.5, duration: 9.6, size: 1.8, opacity: 0.75 },
      { id: 'star-4', left: 52, top: -20, delay: 6.8, duration: 8.9, size: 1.4, opacity: 0.65 },
      { id: 'star-5', left: 68, top: -14, delay: 12.1, duration: 10.2, size: 1.9, opacity: 0.8 },
      { id: 'star-6', left: 82, top: -6, delay: 15.3, duration: 9.2, size: 1.3, opacity: 0.6 },
      { id: 'star-7', left: 94, top: -16, delay: 18.7, duration: 10.8, size: 1.5, opacity: 0.7 }
    ],
    []
  )

  return (
    <DriveLayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, setSidebarActions }}>
      <div className="h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#1A1B1D] dark:text-slate-100">
        {showShootingStars && (
          <div className="shooting-stars">
            {stars.map((star) => (
              <span
                key={star.id}
                className="shooting-star"
                style={{
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                  animationDelay: `${star.delay}s`,
                  animationDuration: `${star.duration}s`,
                  opacity: star.opacity,
                  height: `${star.size}px`,
                  width: `${80 + star.size * 40}px`
                }}
              />
            ))}
          </div>
        )}
        <div className="flex h-screen w-full relative z-10 overflow-hidden">
          <div
            className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
              sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className={`fixed inset-y-0 left-0 z-50 w-72 transform transition md:static md:translate-x-0 md:z-auto md:flex ${
              sidebarOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full'
            }`}
          >
            <DriveSidebar
              onCreateFolder={sidebarActions.onCreateFolder}
              storageLabel={sidebarActions.storageLabel || '0 B'}
              createFolderDisabled={sidebarActions.createFolderDisabled}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
          <div className="flex-1 min-w-0 h-screen overflow-hidden">
            <Outlet />
          </div>
        </div>
      </div>
    </DriveLayoutContext.Provider>
  )
}

export default DriveLayout
