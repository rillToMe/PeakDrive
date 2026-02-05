import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons'

const ActionMenu = ({ open, onToggle, items }) => {
  return (
    <>
      <button
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white border border-slate-200 p-0 text-slate-500 hover:text-slate-800 flex items-center justify-center shadow-sm"
      >
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>
      {open && (
        <div
          className="absolute top-10 right-2 z-10 w-40 rounded-xl border border-slate-200 bg-white shadow-lg p-2 text-sm"
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full px-2 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2 ${item.tone}`}
            >
              <FontAwesomeIcon icon={item.icon} className={item.iconClassName} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export default ActionMenu
