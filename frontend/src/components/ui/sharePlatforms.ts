import { faTelegram, faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { faEnvelope } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export interface SharePlatform {
  id: string
  label: string
  icon: IconDefinition
  href: string
  iconClassName: string
  wrapperClassName: string
}

export const getShareText = (shareUrl: string): string =>
  `Cek file ini di PeakDrive:\n${shareUrl}`

export const getSharePlatforms = (shareUrl: string): SharePlatform[] => {
  const safeUrl = shareUrl || ''
  const text = getShareText(safeUrl)
  const encodedText = encodeURIComponent(text)
  const encodedUrl = encodeURIComponent(safeUrl)
  const encodedSubject = encodeURIComponent('Bagikan file PeakDrive')
  const encodedBody = encodeURIComponent(text)

  return [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: faWhatsapp,
      href: `https://wa.me/?text=${encodedText}`,
      iconClassName: 'text-white',
      wrapperClassName:
        'bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400'
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: faTelegram,
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      iconClassName: 'text-white',
      wrapperClassName:
        'bg-sky-500 text-white hover:bg-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400'
    },
    {
      id: 'email',
      label: 'Email',
      icon: faEnvelope,
      href: `mailto:?subject=${encodedSubject}&body=${encodedBody}`,
      iconClassName: 'text-slate-700 dark:text-slate-100',
      wrapperClassName:
        'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-100 dark:hover:bg-slate-700'
    }
  ]
}
