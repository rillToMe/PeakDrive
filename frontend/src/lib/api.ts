import type { StoredUser } from '../types'

export const getToken = (): string | null => localStorage.getItem('token')

export const setToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

export const setUser = (user: StoredUser | null): void => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  } else {
    localStorage.removeItem('user')
  }
}

export const getUser = (): StoredUser | null => {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}

const safeReadMessage = async (response: Response): Promise<string> => {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

export const apiFetch = async (
  path: string,
  options: RequestInit = {},
  requireAuth = true
): Promise<Response> => {
  const headers: Record<string, string> = options.headers
    ? { ...(options.headers as Record<string, string>) }
    : {}
  if (requireAuth) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  const response = await fetch(path, { ...options, headers })
  if (!response.ok) {
    if (response.status === 401 && requireAuth) {
      setToken(null)
      setUser(null)
      if (typeof window !== 'undefined') {
        window.location.replace('/login')
      }
      throw new Error('Sesi habis. Silakan login ulang.')
    }
    const message = await safeReadMessage(response)
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response
}
