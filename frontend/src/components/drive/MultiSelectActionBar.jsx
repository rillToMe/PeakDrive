import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faXmark, faShareNodes, faDownload } from '@fortawesome/free-solid-svg-icons'

const MultiSelectActionBar = ({
  selectedCount,
  onClear,
  onDelete,
  onShare,
  onDownload
}) => {
  if (selectedCount === 0) return null

  return (
    <div className="w-full bg-sky-50/95 border-b border-sky-100 px-8 py-3 flex items-center justify-between dark:bg-sky-950/20 dark:border-sky-900/30 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={onClear}
          className="h-8 w-8 rounded-full flex items-center justify-center text-sky-600 hover:bg-sky-100 transition dark:text-sky-400 dark:hover:bg-sky-900/40"
          title="Batalkan pilihan"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <div className="text-sm font-semibold text-sky-900 dark:text-sky-200">
          {selectedCount} item dipilih
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          disabled
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-100 text-sky-700 hover:bg-sky-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60"
        >
          <FontAwesomeIcon icon={faDownload} className="text-[10px]" />
          <span className="hidden sm:inline">Download</span>
        </button>
        <button
          onClick={onShare}
          disabled
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-100 text-sky-700 hover:bg-sky-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60"
        >
          <FontAwesomeIcon icon={faShareNodes} className="text-[10px]" />
          <span className="hidden sm:inline">Share</span>
        </button>
        <div className="w-px h-5 bg-sky-200/60 mx-1 dark:bg-sky-800/40" />
        <button
          onClick={onDelete}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition flex items-center gap-2 shadow-sm"
        >
          <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
          <span>Hapus</span>
        </button>
      </div>
    </div>
  )
}

export default MultiSelectActionBar
