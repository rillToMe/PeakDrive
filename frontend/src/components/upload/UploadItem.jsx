import { useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleXmark,
  faXmark,
  faBan,
  faClock
} from '@fortawesome/free-solid-svg-icons'

const formatDuration = (seconds) => {
  const safe = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  if (minutes === 0) {
    return `${rest}s`
  }
  return `${minutes}m ${rest}s`
}

const UploadItem = ({ item, onCancel }) => {
  const radius = 12
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (item.progress / 100) * circumference

  const status = useMemo(() => {
    if (item.status === 'done') {
      return { label: 'Selesai', icon: faCircleCheck, tone: 'text-emerald-600' }
    }
    if (item.status === 'error') {
      return { label: 'Gagal', icon: faCircleXmark, tone: 'text-red-500' }
    }
    if (item.status === 'canceled') {
      return { label: 'Dibatalkan', icon: faBan, tone: 'text-slate-400' }
    }
    return { label: 'Mengupload', icon: faClock, tone: 'text-slate-500' }
  }, [item.status])

  const estimate = useMemo(() => {
    if (item.status !== 'uploading') return null
    if (!Number.isFinite(item.estimateSeconds)) return null
    return formatDuration(item.estimateSeconds)
  }, [item.estimateSeconds, item.status])

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="relative h-8 w-8">
        {item.status === 'uploading' ? (
          <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r={radius}
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-slate-200 dark:text-slate-700"
            />
            <circle
              cx="16"
              cy="16"
              r={radius}
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="text-blue-600 transition-all"
            />
          </svg>
        ) : (
          <div
            className={`h-8 w-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center dark:bg-[#1F2023] dark:border-slate-700 ${status.tone}`}
          >
            <FontAwesomeIcon icon={status.icon} />
          </div>
        )}
        {item.status === 'uploading' && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-700 dark:text-slate-200">
            {item.progress}%
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800 truncate dark:text-slate-100 leading-tight">{item.filename}</div>
        <div className="text-xs font-normal text-slate-500/80 flex items-center gap-2 dark:text-slate-400/80 mt-0.5">
          <span className={status.tone}>{status.label}</span>
          {item.status === 'uploading' && estimate && <span className="text-slate-400/60 font-normal">~{estimate}</span>}
        </div>
      </div>
      {item.status === 'uploading' && (
        <button
          onClick={() => onCancel(item.id)}
          className="h-8 w-8 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
    </div>
  )
}

export default UploadItem
