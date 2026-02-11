import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDatabase, faFolderPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { faGithub, faInstagram, faTiktok } from '@fortawesome/free-brands-svg-icons'

const DriveSidebar = ({ onCreateFolder, storageLabel, onClose }) => {
  return (
    <aside className="w-72 bg-white border-r border-slate-200/50 px-5 py-6 flex flex-col h-full overflow-hidden flex-shrink-0 dark:bg-[#161719] dark:border-slate-800/50">
      <div className="relative flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.2em] font-medium text-sky-500/90">PeakDrive</div>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="md:hidden h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#2a2c30]"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      <div className="relative mt-2 text-2xl font-semibold leading-tight text-slate-900 dark:text-slate-100">
        PeakDrive
        <span className="pointer-events-none absolute -top-2 right-4 h-3 w-12 rotate-12 bg-gradient-to-r from-transparent via-sky-400/70 to-transparent blur-sm opacity-70 animate-pulse" />
      </div>
      <div className="text-base leading-relaxed text-slate-500 mt-1 dark:text-slate-300">
        Private drive yang rapi
      </div>

      <div className="mt-6 space-y-3">
        <button
          onClick={onCreateFolder}
          className="w-full px-4 py-2.5 rounded-2xl bg-emerald-600 text-sm font-medium hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-sm text-white ring-1 ring-emerald-200/60 dark:ring-emerald-500/40"
        >
          <FontAwesomeIcon icon={faFolderPlus} />
          Buat Folder
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-[#1F2023]">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500/80 dark:text-slate-300/80">
          <FontAwesomeIcon icon={faDatabase} />
          Total Penyimpanan
        </div>
        <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {storageLabel}
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-200/80 overflow-hidden dark:bg-slate-700/60">
          <div className="h-full w-full bg-gradient-to-r from-sky-400 to-indigo-500/80" />
        </div>
      </div>

      <div className="mt-auto pt-8 text-[0.9rem] leading-[1.5] text-slate-500 space-y-4 dark:text-slate-400">
        <div>Dev: Ditdev</div>
        <div>© {new Date().getFullYear()} Ditdev. All rights reserved.</div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/rillToMe"
            target="_blank"
            rel="noreferrer"
            className="group relative h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-300 dark:hover:bg-[#2a2c30] dark:hover:text-white"
          >
            <FontAwesomeIcon icon={faGithub} className="h-4 w-4" />
            <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              GitHub
            </span>
          </a>
          <a
            href="https://www.tiktok.com/@goodvibes_music28"
            target="_blank"
            rel="noreferrer"
            className="group relative h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-300 dark:hover:bg-[#2a2c30] dark:hover:text-white"
          >
            <FontAwesomeIcon icon={faTiktok} className="h-4 w-4" />
            <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              TikTok
            </span>
          </a>
          <a
            href="https://www.instagram.com/rill_lyrics"
            target="_blank"
            rel="noreferrer"
            className="group relative h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:bg-[#1F2023] dark:text-slate-300 dark:hover:bg-[#2a2c30] dark:hover:text-white"
          >
            <FontAwesomeIcon icon={faInstagram} className="h-4 w-4" />
            <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900/90 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              Instagram
            </span>
          </a>
        </div>
      </div>
    </aside>
  )
}

export default DriveSidebar
