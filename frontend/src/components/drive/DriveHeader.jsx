import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown,
  faChevronRight,
  faGear,
  faHouse,
  faMagnifyingGlass,
  faPalette,
  faRightFromBracket,
  faUserGear,
  faCircleInfo,
  faXmark
} from '@fortawesome/free-solid-svg-icons'
import UploadButton from './UploadButton.jsx'

const resolveTheme = (value) => {
  if (value === 'device') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return value
}

const applyTheme = (value) => {
  const resolved = resolveTheme(value)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = value
}

const DriveHeader = ({
  user,
  canManage,
  onAdmin,
  onLogout,
  path,
  onBreadcrumb,
  onUpload,
  searchValue,
  onSearchChange
}) => {
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('peakdrive-theme') || 'device')
  const [shootingStarsEnabled, setShootingStarsEnabled] = useState(
    () => localStorage.getItem('peakdrive-exp-shooting-stars') === 'true'
  )
  const profileRef = useRef(null)
  const avatarLetter = (user?.email || 'U').trim().charAt(0).toUpperCase()
  const roleLabel = user?.role || 'User'
  const emailName = user?.email ? user.email.split('@')[0] : 'User'
  const displayName = emailName
    .replace(/[^a-zA-Z]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || emailName

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!profileRef.current || profileRef.current.contains(event.target)) return
      setProfileOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    const handleUpdate = () => {
      const stored = localStorage.getItem('peakdrive-theme') || 'device'
      setTheme(stored)
      applyTheme(stored)
    }
    window.addEventListener('theme-change', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('theme-change', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [settingsOpen])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const handleThemeChange = (value) => {
    localStorage.setItem('peakdrive-theme', value)
    applyTheme(value)
    window.dispatchEvent(new Event('theme-change'))
    setTheme(value)
  }

  useEffect(() => {
    const handleUpdate = () => {
      setShootingStarsEnabled(localStorage.getItem('peakdrive-exp-shooting-stars') === 'true')
    }
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('experiment-change', handleUpdate)
    return () => {
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('experiment-change', handleUpdate)
    }
  }, [])

  const handleShootingStarsToggle = (value) => {
    localStorage.setItem('peakdrive-exp-shooting-stars', value ? 'true' : 'false')
    setShootingStarsEnabled(value)
    window.dispatchEvent(new Event('experiment-change'))
  }

  return (
    <>
      <header className="bg-gradient-to-r from-sky-50 via-white to-emerald-50 border-b border-slate-200 text-slate-900 dark:from-[#1A1B1D] dark:via-[#1A1B1D] dark:to-[#1A1B1D] dark:border-slate-800 dark:text-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-sky-500">PeakDrive</div>
            <h1 className="text-2xl font-semibold bg-gradient-to-r from-slate-900 to-sky-700 bg-clip-text text-transparent dark:from-slate-100 dark:to-sky-300">
              Private drive untuk tim
            </h1>
            <p className="text-sm text-slate-600 mt-1 dark:text-slate-300">
              Semua file aman dan terorganisir
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((value) => !value)}
                className="flex items-center gap-3 rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-sm shadow-sm hover:bg-white dark:border-slate-700 dark:bg-[#202225] dark:hover:bg-[#2a2c30]"
              >
                <span className="relative group">
                  <span className="h-8 w-8 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
                    {avatarLetter}
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-full mt-2 flex w-max max-w-[280px] -translate-x-1/2 flex-col rounded-xl border border-slate-200 bg-slate-900/90 text-white px-3 py-2 text-xs opacity-0 shadow-lg transition group-hover:opacity-100 z-50 dark:border-slate-700">
                    <span className="text-[11px] uppercase tracking-wider text-slate-300">Akun</span>
                    <span className="font-semibold text-white break-all mt-0.5">{user?.email}</span>
                  </span>
                </span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`text-slate-400 transition ${profileOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl p-4 z-20 dark:border-slate-700 dark:bg-[#202225]">
                  <div className="rounded-2xl bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4 py-4 text-center dark:from-[#1F2023] dark:via-[#1F2023] dark:to-[#1F2023]">
                    <div className="text-xs text-slate-500 break-all dark:text-slate-300">{user?.email}</div>
                    <div className="mx-auto mt-3 h-16 w-16 rounded-full bg-slate-900 text-white text-lg font-semibold flex items-center justify-center">
                      {avatarLetter}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Halo, {displayName}.
                    </div>
                    <div
                      className={`mt-1 text-xs font-semibold ${
                        roleLabel === 'MasterAdmin'
                          ? 'text-amber-600'
                          : roleLabel === 'Admin'
                          ? 'text-sky-600'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {roleLabel}
                    </div>
                  </div>
                  <div className="h-px bg-slate-200/80 my-4 dark:bg-slate-700" />
                  {canManage && (
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        onAdmin()
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-2 dark:border-slate-700 dark:bg-[#202225] dark:text-slate-100 dark:hover:bg-[#2a2c30]"
                    >
                      <FontAwesomeIcon icon={faUserGear} />
                      Admin Manage
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setProfileOpen(false)
                      setSettingsOpen(true)
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-2 mt-3 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30]"
                  >
                    <FontAwesomeIcon icon={faGear} />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false)
                      onLogout()
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-2 mt-3 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#2a2c30]"
                  >
                    <FontAwesomeIcon icon={faRightFromBracket} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <section className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 md:p-5 flex flex-col gap-4 lg:flex-row lg:items-center shadow-sm backdrop-blur max-w-6xl mx-auto dark:bg-[#202225] dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={() => onBreadcrumb(-1)}
            className="flex items-center gap-2 text-sky-700 hover:text-sky-800 bg-sky-50 px-3 py-1.5 rounded-full dark:bg-slate-800/80 dark:text-sky-300 dark:hover:text-sky-200"
          >
            <FontAwesomeIcon icon={faHouse} />
            Root
          </button>
          {path.map((item, index) => (
            <button
              key={item.publicId}
              onClick={() => onBreadcrumb(index)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-slate-100/80 px-3 py-1.5 rounded-full dark:bg-slate-800/70 dark:text-slate-200 dark:hover:text-white"
            >
              <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
              {item.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <div className="relative w-full sm:w-72 lg:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </span>
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Cari folder atau file..."
              className="w-full rounded-full border border-slate-200 bg-white px-9 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-700/40"
            />
          </div>
          <UploadButton onUpload={onUpload} />
        </div>
      </section>
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 dark:border-slate-700 dark:bg-[#202225]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-sky-500">Settings</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Pengaturan Drive
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-300">
                  Atur tampilan dan lisensi aplikasi.
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#2a2c30]"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-[#1F2023]">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <FontAwesomeIcon icon={faPalette} className="text-sky-500" />
                Mode Tampilan
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'light', label: 'Light', desc: 'Tampilan cerah klasik.' },
                  { value: 'dark', label: 'Dark', desc: 'Nyaman untuk malam.' },
                  { value: 'device', label: 'Device', desc: 'Ikuti sistem.' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                      theme === option.value
                        ? 'border-sky-300 bg-sky-50 text-slate-900 dark:border-sky-600 dark:bg-[#232428] dark:text-slate-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-[#202225] dark:text-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={option.value}
                      checked={theme === option.value}
                      onChange={() => handleThemeChange(option.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-semibold">{option.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#202225]">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <FontAwesomeIcon icon={faGear} className="text-emerald-500" />
                Experimental
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-200">
                <div>
                  <div className="font-semibold">Bintang Jatuh</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Muncul sesekali saat dark mode aktif.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleShootingStarsToggle(!shootingStarsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                    shootingStarsEnabled
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'bg-slate-200 border-slate-200 dark:bg-slate-700 dark:border-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      shootingStarsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#202225]">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <FontAwesomeIcon icon={faCircleInfo} className="text-sky-500" />
                About Licence
              </div>
              <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">Pemilik Lisensi</div>
                  <div>Ditdev</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">Hak Cipta</div>
                  <div>© {new Date().getFullYear()} Ditdev. Semua hak dilindungi.</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">Ketentuan Penggunaan</div>
                  <div>
                    Aplikasi ini dilisensikan untuk penggunaan internal dan tidak boleh didistribusikan ulang tanpa
                    izin tertulis dari pemilik lisensi.
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">Kontak</div>
                  <div>rillToMe</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  )
}

export default DriveHeader
