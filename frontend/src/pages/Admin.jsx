import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getUser } from '../lib/api.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faEye,
  faEyeSlash,
  faKey,
  faTrash,
  faUserPlus,
  faUserShield,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import AdminSkeleton from '../components/skeleton/AdminSkeleton.jsx'

const Admin = () => {
  const navigate = useNavigate()
  const user = useMemo(() => getUser(), [])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('User')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [resetUserId, setResetUserId] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)

  const isMaster = user?.role === 'MasterAdmin'
  const isAdmin = user?.role === 'Admin' || isMaster

  useEffect(() => {
    if (!isAdmin) {
      navigate('/drive')
    }
  }, [isAdmin, navigate])

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch('/api/admin/list-users')
      const data = await response.json()
      setUsers(data)
    } catch (err) {
      setError(err.message || 'Gagal memuat user.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const endpoint = role === 'Admin' ? '/api/admin/create-admin' : '/api/admin/create-user'
      await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      setEmail('')
      setPassword('')
      setRole('User')
      loadUsers()
    } catch (err) {
      setError(err.message || 'Gagal membuat akun.')
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (!resetUserId || !resetPassword.trim()) {
      return
    }
    setError('')
    try {
      await apiFetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: resetUserId, newPassword: resetPassword }),
      })
      setResetPassword('')
      setResetUserId(null)
      setShowResetPassword(false)
    } catch (err) {
      setError(err.message || 'Gagal reset password.')
    }
  }

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm('Hapus user ini?')
    if (!confirmed) return
    setError('')
    try {
      await apiFetch(`/api/admin/delete-user/${userId}`, { method: 'DELETE' })
      loadUsers()
    } catch (err) {
      setError(err.message || 'Gagal menghapus user.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <FontAwesomeIcon icon={faUserShield} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Admin Manage</h1>
              <p className="text-sm text-slate-500">Kelola akun pengguna PeakDrive</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/drive')}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Kembali ke Drive
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-700">
            <FontAwesomeIcon icon={faUserPlus} />
            Buat Akun Baru
          </div>
          <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1.1fr_1fr_1fr]">
            <div>
              <label className="text-xs text-slate-500">Email</label>
              <input
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                placeholder="email@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Password</label>
              <div className="mt-1 flex gap-2">
                <input
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm flex-1"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showCreatePassword ? 'text' : 'password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((prev) => !prev)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-slate-600 text-sm"
                >
                  <FontAwesomeIcon icon={showCreatePassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-slate-500">Role</label>
                <select
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  <option value="User">User</option>
                  {isMaster && <option value="Admin">Admin</option>}
                </select>
              </div>
              <button className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faUserPlus} />
                Buat
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FontAwesomeIcon icon={faUsers} />
              Daftar User
            </div>
            <div className="text-xs text-slate-400">{users.length} akun</div>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {error}
            </div>
          )}
          {loading ? (
            <AdminSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2">ID</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Dibuat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0 align-top">
                      <td className="py-3">{item.id}</td>
                      <td className="py-3">{item.email}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-600">
                          {item.role}
                        </span>
                      </td>
                      <td className="py-3">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setResetUserId(item.id)
                              setResetPassword('')
                              setShowResetPassword(false)
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs flex items-center gap-2"
                          >
                            <FontAwesomeIcon icon={faKey} />
                            Reset PW
                          </button>
                          <button
                            onClick={() => handleDeleteUser(item.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs flex items-center gap-2"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                            Delete
                          </button>
                        </div>
                        {resetUserId === item.id && (
                          <form onSubmit={handleResetPassword} className="mt-2 flex flex-wrap gap-2">
                            <div className="flex-1">
                              <label className="text-[11px] text-slate-500">Password baru</label>
                              <div className="mt-1 flex gap-2">
                                <input
                                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs flex-1"
                                  placeholder="Password baru"
                                  value={resetPassword}
                                  onChange={(event) => setResetPassword(event.target.value)}
                                  type={showResetPassword ? 'text' : 'password'}
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowResetPassword((prev) => !prev)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs"
                                >
                                  <FontAwesomeIcon icon={showResetPassword ? faEyeSlash : faEye} />
                                </button>
                                <button className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs">
                                  Simpan
                                </button>
                              </div>
                            </div>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Admin
