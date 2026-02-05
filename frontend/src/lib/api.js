export const getToken = () => localStorage.getItem('token')

export const setToken = (token) => {
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

export const setUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  } else {
    localStorage.removeItem('user')
  }
}

export const getUser = () => {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const apiFetch = async (path, options = {}, requireAuth = true) => {
  const headers = options.headers ? { ...options.headers } : {}
  if (requireAuth) {
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  const response = await fetch(path, { ...options, headers })
  if (!response.ok) {
    const message = await safeReadMessage(response)
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response
}

const safeReadMessage = async (response) => {
  try {
    const text = await response.text()
    return text
  } catch {
    return ''
  }
}
