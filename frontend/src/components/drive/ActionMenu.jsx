import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons'

const ActionMenu = ({
  open,
  onToggle,
  items,
  containerClassName = 'relative',
  buttonClassName = '',
  menuClassName = ''
}) => {
  return (
    <div className={containerClassName}>
      <button
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        className={`h-8 w-8 rounded-full bg-transparent border border-transparent p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 flex items-center justify-center dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30] ${buttonClassName}`}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>
      {open && (
        <div
          className={`absolute top-10 right-2 z-30 w-40 rounded-xl border border-slate-200 bg-white shadow-lg p-2 text-sm dark:border-slate-700 dark:bg-[#202225] ${menuClassName}`}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full px-2 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2 dark:hover:bg-[#2a2c30] ${item.tone}`}
            >
              <FontAwesomeIcon icon={item.icon} className={item.iconClassName} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActionMenu
