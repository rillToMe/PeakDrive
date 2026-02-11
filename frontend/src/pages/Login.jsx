import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken, setUser } from '../lib/api.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEye,
  faEyeSlash,
  faLock,
  faRightToBracket,
  faUserShield,
} from '@fortawesome/free-solid-svg-icons'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        throw new Error('Login gagal. Email atau password salah.')
      }
      const data = await response.json()
      setToken(data.token)
      setUser(data.user)
      navigate('/drive')
    } catch (err) {
      setError(err.message || 'Login gagal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-[#1A1B1D] dark:text-slate-100">
      <div className="w-full max-w-md bg-white shadow-sm rounded-2xl p-6 border border-slate-200 dark:bg-[#202225] dark:border-slate-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <FontAwesomeIcon icon={faUserShield} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">PeakDrive</h1>
            <p className="text-slate-600 text-base dark:text-slate-300 mt-0.5">Login dengan akun resmi admin</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500/80 dark:text-slate-300/80 uppercase tracking-wide">Email</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 dark:border-slate-700 dark:bg-[#1F2023] focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition">
              <FontAwesomeIcon icon={faUserShield} className="text-slate-400 dark:text-slate-400" />
              <input
                className="w-full outline-none text-sm bg-transparent text-slate-900 dark:text-slate-100"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@company.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500/80 dark:text-slate-300/80 uppercase tracking-wide">Password</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 dark:border-slate-700 dark:bg-[#1F2023] focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition">
              <FontAwesomeIcon icon={faLock} className="text-slate-400 dark:text-slate-400" />
              <input
                className="w-full outline-none text-sm bg-transparent text-slate-900 dark:text-slate-100"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </div>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 dark:bg-red-950/40 dark:border-red-900/60">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 text-white py-2 font-medium hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faRightToBracket} />
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
