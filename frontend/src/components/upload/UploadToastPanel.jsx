import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp, faXmark } from '@fortawesome/free-solid-svg-icons'
import useUploadQueue from '../../hooks/useUploadQueue.js'
import UploadItem from './UploadItem.jsx'

const UploadToastPanel = () => {
  const { uploads, cancelUpload, lastAddedId } = useUploadQueue()
  const [collapsed, setCollapsed] = useState(false)
  const [closedAtId, setClosedAtId] = useState(null)

  const uploadingCount = useMemo(
    () => uploads.filter((item) => item.status === 'uploading').length,
    [uploads]
  )
  const doneCount = useMemo(() => uploads.filter((item) => item.status === 'done').length, [uploads])
  const headerText =
    uploadingCount > 0 ? `Mengupload ${uploadingCount} item` : `${doneCount || uploads.length} upload selesai`

  if (uploads.length === 0 || (closedAtId && closedAtId === lastAddedId)) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50">
      <div className="w-full sm:w-[360px] bg-white border border-slate-200 rounded-2xl shadow-2xl dark:bg-[#202225] dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{headerText}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="h-8 w-8 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
            >
              <FontAwesomeIcon icon={collapsed ? faChevronUp : faChevronDown} />
            </button>
            <button
              onClick={() => setClosedAtId(lastAddedId)}
              className="h-8 w-8 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="px-4 py-2 max-h-80 overflow-auto">
            {uploads.map((item) => (
              <UploadItem key={item.id} item={item} onCancel={cancelUpload} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default UploadToastPanel
