import { useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export interface ActionMenuItem {
  label: string
  icon: IconDefinition
  tone?: string
  iconClassName?: string
  onClick?: () => void
}

interface ActionMenuProps {
  open: boolean
  onToggle: () => void
  items: ActionMenuItem[]
  containerClassName?: string
  buttonClassName?: string
  menuClassName?: string
}

const ActionMenu = ({
  open,
  onToggle,
  items,
  containerClassName = 'relative',
  buttonClassName = '',
  menuClassName = ''
}: ActionMenuProps) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')
  const [maxHeight, setMaxHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const buttonEl = buttonRef.current
      const menuEl = menuRef.current
      if (!buttonEl || !menuEl) return
      const rect = buttonEl.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const offset = 8
      const spaceBelow = viewportHeight - rect.bottom - offset
      const spaceAbove = rect.top - offset
      const menuHeight = menuEl.scrollHeight
      if (spaceBelow >= menuHeight) {
        setPlacement('bottom')
        setMaxHeight(null)
        return
      }
      if (spaceAbove >= menuHeight) {
        setPlacement('top')
        setMaxHeight(null)
        return
      }
      if (spaceBelow >= spaceAbove) {
        setPlacement('bottom')
        setMaxHeight(Math.max(140, spaceBelow))
      } else {
        setPlacement('top')
        setMaxHeight(Math.max(140, spaceAbove))
      }
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, items.length])

  return (
    <div className={containerClassName}>
      <button
        ref={buttonRef}
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          event.stopPropagation()
          onToggle()
        }}
        className={`h-8 w-8 rounded-full bg-transparent border border-transparent p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 flex items-center justify-center dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30] ${buttonClassName}`}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className={`absolute z-30 w-40 rounded-xl border border-slate-200 bg-white shadow-lg p-2 text-sm dark:border-slate-700 dark:bg-[#202225] ${
            placement === 'top'
              ? 'bottom-full mb-2 origin-bottom animate-in fade-in slide-in-from-bottom-2'
              : 'top-full mt-2 origin-top animate-in fade-in slide-in-from-top-2'
          } ${maxHeight ? 'overflow-y-auto' : ''} ${menuClassName}`}
          style={maxHeight ? { maxHeight } : undefined}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 font-medium transition dark:hover:bg-[#2a2c30] ${item.tone}`}
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
