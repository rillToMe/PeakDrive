import { useCallback, useEffect, useMemo, useState } from 'react'
import enMessages from './en.json'
import indMessages from './ind.json'

export type Language = 'en' | 'ind'

type Messages = Record<string, string>

const LANG_KEY = 'peakdrive-lang'
const FALLBACK_LANG: Language = 'en'
const en = enMessages as Messages
const ind = indMessages as Messages
const dictionaries: Record<Language, Messages> = { en, ind }

export type TranslateFn = (
  key: string,
  replacements?: Record<string, string | number>
) => string

const getStoredLanguage = (): Language => {
  const stored = localStorage.getItem(LANG_KEY)
  return stored === 'ind' ? 'ind' : FALLBACK_LANG
}

const resolveMessages = (lang: Language): Messages => dictionaries[lang] || dictionaries[FALLBACK_LANG]

export interface UseI18nResult {
  lang: Language
  setLanguage: (value: Language) => void
  t: TranslateFn
}

const useI18n = (): UseI18nResult => {
  const [lang, setLang] = useState<Language>(getStoredLanguage)

  useEffect(() => {
    const handleUpdate = () => {
      setLang(getStoredLanguage())
    }
    window.addEventListener('language-change', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('language-change', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const setLanguage = useCallback((value: Language) => {
    localStorage.setItem(LANG_KEY, value)
    window.dispatchEvent(new Event('language-change'))
    setLang(value)
  }, [])

  const messages = useMemo(() => resolveMessages(lang), [lang])

  const t = useCallback<TranslateFn>(
    (key, replacements) => {
      let text: string = messages?.[key] || en?.[key] || key
      if (replacements && typeof replacements === 'object') {
        Object.entries(replacements).forEach(([token, value]) => {
          text = text.replaceAll(`{${token}}`, String(value))
        })
      }
      return text
    },
    [messages]
  )

  return { lang, setLanguage, t }
}

export default useI18n
