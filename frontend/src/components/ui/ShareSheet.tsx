import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShareNodes, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { SharePlatform } from './sharePlatforms'

interface ShareSheetProps {
  open: boolean
  shareUrl: string
  loading: boolean
  error: string
  copySuccess: boolean
  onClose: () => void
  onCopy: () => void
  platforms: SharePlatform[]
}

const ShareSheet = ({
  open,
  shareUrl,
  loading,
  error,
  copySuccess,
  onClose,
  onCopy,
  platforms
}: ShareSheetProps) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl sm:rounded-2xl rounded-t-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-[#1F2023]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-sky-50 flex items-center justify-center dark:bg-sky-950/40">
              <FontAwesomeIcon icon={faShareNodes} className="text-sky-500" />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">Bagikan</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Share link untuk file atau folder</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500/80 dark:text-slate-400/80 uppercase tracking-wide">
              Link share
            </label>
            <input
              readOnly
              value={shareUrl}
              placeholder={loading ? 'Menyiapkan link...' : 'Link akan muncul di sini'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            />
            {error && <div className="text-xs text-rose-500">{error}</div>}
          </div>
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500/80 dark:text-slate-400/80 uppercase tracking-wide">
              Bagikan ke
            </div>
            <div className="flex items-center gap-3">
              {platforms.map((platform) => (
                <a
                  key={platform.id}
                  href={platform.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`group flex flex-col items-center gap-2 transition ${
                    !shareUrl || loading ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <div
                    className={`h-11 w-11 rounded-full flex items-center justify-center shadow-sm transition duration-200 active:scale-95 ${platform.wrapperClassName}`}
                  >
                    <FontAwesomeIcon icon={platform.icon} className={`text-lg ${platform.iconClassName}`} />
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {platform.label}
                  </span>
                </a>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onCopy}
              disabled={!shareUrl || loading}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                copySuccess
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400'
                  : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
              }`}
            >
              {copySuccess ? 'Link Tersalin' : 'Salin Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShareSheet
