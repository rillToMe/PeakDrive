import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderOpen, faXmark } from '@fortawesome/free-solid-svg-icons'

const FolderExistsModal = ({ folderName, onCancel, onContinue }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center dark:bg-amber-950/30">
              <FontAwesomeIcon icon={faFolderOpen} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Folder sudah ada
            </h3>
          </div>
          <button 
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        
        <div className="px-6 py-6">
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
            Folder dengan nama <span className="font-semibold text-slate-900 dark:text-slate-100">"{folderName}"</span> sudah ada di lokasi ini. 
            Apakah Anda ingin melanjutkan upload dengan nama baru (Auto-rename)?
          </p>
          
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              onClick={onContinue}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 transition dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shadow-sm"
            >
              Lanjut Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FolderExistsModal
