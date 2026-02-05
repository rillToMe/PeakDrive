import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faFolderPlus, faHouse, faRightFromBracket, faUserGear } from '@fortawesome/free-solid-svg-icons'
import UploadButton from './UploadButton.jsx'

const DriveHeader = ({ user, canManage, onAdmin, onLogout, path, onBreadcrumb, onUpload, onCreateFolder }) => {
  return (
    <>
      <header className="bg-white border-b border-slate-200 text-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">PeakDrive</div>
            <h1 className="text-2xl font-semibold text-slate-900">Private drive untuk tim</h1>
            <p className="text-sm text-slate-500 mt-1">Semua file aman dan terorganisir</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-left min-w-[240px] shadow-sm">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Login sebagai</div>
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.email}</div>
              <div className="text-xs text-slate-500">{user?.role}</div>
            </div>
            {canManage && (
              <button
                onClick={onAdmin}
                className="px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-2 shadow-sm"
              >
                <FontAwesomeIcon icon={faUserGear} />
                Admin Manage
              </button>
            )}
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-full border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 flex items-center gap-2 shadow-sm"
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
              Logout
            </button>
          </div>
        </div>
      </header>
      <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:relative shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:justify-center">
          <button
            onClick={() => onBreadcrumb(-1)}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-full"
          >
            <FontAwesomeIcon icon={faHouse} />
            Root
          </button>
          {path.map((item, index) => (
            <button
              key={item.publicId}
              onClick={() => onBreadcrumb(index)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-full"
            >
              <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
              {item.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <UploadButton onUpload={onUpload} />
          <button
            onClick={onCreateFolder}
            className="px-4 py-2 rounded-full border border-slate-300 text-sm hover:bg-slate-50 flex items-center gap-2 shadow-sm text-slate-700"
          >
            <FontAwesomeIcon icon={faFolderPlus} />
            Buat
          </button>
        </div>
      </section>
    </>
  )
}

export default DriveHeader
