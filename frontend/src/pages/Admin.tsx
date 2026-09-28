import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getUser } from '../lib/api'
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
  faCheck,
  faSpinner
} from '@fortawesome/free-solid-svg-icons'
import AdminSkeleton from '../components/skeleton/AdminSkeleton'
import type { AdminUser, UserRole } from '../types'

const Admin = () => {
  const navigate = useNavigate()
  const user = useMemo(() => getUser(), [])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('User')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

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
      const data = (await response.json()) as AdminUser[]
      setUsers(data)
    } catch (err) {
      setError((err as Error).message || 'Gagal memuat user.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin])

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setCreatingUser(true)
    try {
      const endpoint = role === 'Admin' ? '/api/admin/create-admin' : '/api/admin/create-user'
      await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      setEmail('')
      setPassword('')
      setRole('User')
      showSuccess(`Akun ${role} berhasil dibuat!`)
      loadUsers()
    } catch (err) {
      setError((err as Error).message || 'Gagal membuat akun.')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!resetUserId || !resetPassword.trim()) {
      return
    }
    setError('')
    setResettingPassword(true)
    try {
      await apiFetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: resetUserId, newPassword: resetPassword })
      })
      setResetPassword('')
      setResetUserId(null)
      setShowResetPassword(false)
      showSuccess('Password berhasil direset!')
    } catch (err) {
      setError((err as Error).message || 'Gagal reset password.')
    } finally {
      setResettingPassword(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    const confirmed = window.confirm('Hapus user ini?')
    if (!confirmed) return
    setError('')
    try {
      await apiFetch(`/api/admin/delete-user/${userId}`, { method: 'DELETE' })
      showSuccess('User berhasil dihapus!')
      loadUsers()
    } catch (err) {
      setError((err as Error).message || 'Gagal menghapus user.')
    }
  }

  const getRoleBadgeColor = (roleValue: string) => {
    switch (roleValue) {
      case 'MasterAdmin':
        return 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
      case 'Admin':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300'
    }
  }

  return (
    <div className="min-h-screen h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-sky-50/30 to-blue-50/40 dark:from-[#0F1014] dark:via-[#1A1B1D] dark:to-[#1A1B1D]">
      {/* Header with Glass Effect */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/60 dark:bg-[#202225]/80 dark:border-slate-700/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 transform transition-transform hover:scale-105">
                <FontAwesomeIcon icon={faUserShield} className="text-lg sm:text-xl" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">Kelola akun pengguna PeakDrive</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/drive')}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50 flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-md font-medium text-sm"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Kembali</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-16 space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="animate-[slideDown_0.3s_ease-out] bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl px-4 py-3 shadow-lg shadow-emerald-500/30 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faCheck} />
            </div>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="animate-[slideDown_0.3s_ease-out] bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-2xl px-4 py-3 shadow-lg shadow-red-500/30">
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Create Account Card */}
        <section className="group bg-white dark:bg-[#202225] border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:via-sky-500/5 dark:to-cyan-500/5 px-5 sm:px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center shadow-md">
                <FontAwesomeIcon icon={faUserPlus} className="text-white text-sm" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Buat Akun Baru</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">Tambahkan user atau admin baru</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    Email Address
                  </label>
                  <input
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-[#1F2023] dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all duration-200"
                    placeholder="user@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Password</label>
                  <div className="flex gap-2">
                    <input
                      className="px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm flex-1 dark:bg-[#1F2023] dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all duration-200"
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showCreatePassword ? 'text' : 'password'}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((prev) => !prev)}
                      className="px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200"
                    >
                      <FontAwesomeIcon icon={showCreatePassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Role</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-[#1F2023] dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all duration-200"
                    value={role}
                    onChange={(event) => setRole(event.target.value as UserRole)}
                  >
                    <option value="User">User</option>
                    {isMaster && <option value="Admin">Admin</option>}
                  </select>
                </div>

                <div className="sm:self-end">
                  <button
                    disabled={creatingUser}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white text-sm font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingUser ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        <span>Membuat...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUserPlus} />
                        <span>Buat Akun</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* Users List Card */}
        <section className="group bg-white dark:bg-[#202225] border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 dark:from-blue-500/5 dark:via-cyan-500/5 dark:to-teal-500/5 px-5 sm:px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                  <FontAwesomeIcon icon={faUsers} className="text-white text-sm" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Daftar Pengguna</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Kelola semua akun pengguna</p>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-md">
                {users.length} Akun
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {loading ? (
              <AdminSkeleton />
            ) : (
              <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Dibuat
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {users.map((item, index) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-150"
                          style={{
                            animation: `fadeIn 0.3s ease-out ${index * 0.05}s both`
                          }}
                        >
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
                              #{item.id}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {item.email}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getRoleBadgeColor(item.role)} shadow-sm`}>
                              {item.role}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {new Date(item.createdAt).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    setResetUserId(item.id)
                                    setResetPassword('')
                                    setShowResetPassword(false)
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-md"
                                >
                                  <FontAwesomeIcon icon={faKey} />
                                  Reset Password
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(item.id)}
                                  className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-semibold flex items-center gap-2 transition-all duration-200 hover:shadow-md"
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                  Hapus
                                </button>
                              </div>

                              {resetUserId === item.id && (
                                <form
                                  onSubmit={handleResetPassword}
                                  className="animate-[slideDown_0.3s_ease-out] mt-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700"
                                >
                                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 block">
                                    Password Baru untuk {item.email}
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      className="px-3 py-2 border-2 border-slate-200 dark:border-slate-700 rounded-lg text-sm flex-1 dark:bg-[#1F2023] dark:text-slate-100 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none"
                                      placeholder="Masukkan password baru"
                                      value={resetPassword}
                                      onChange={(event) => setResetPassword(event.target.value)}
                                      type={showResetPassword ? 'text' : 'password'}
                                      required
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowResetPassword((prev) => !prev)}
                                      className="px-3 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                    >
                                      <FontAwesomeIcon icon={showResetPassword ? faEyeSlash : faEye} />
                                    </button>
                                    <button
                                      disabled={resettingPassword}
                                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                                    >
                                      {resettingPassword ? (
                                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                      ) : (
                                        'Simpan'
                                      )}
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Custom Scrollbar Styles */
        ::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }

        .dark ::-webkit-scrollbar-track {
          background: #1e293b;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #3b82f6, #0ea5e9);
          border-radius: 10px;
          border: 2px solid #f1f5f9;
        }

        .dark ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #3b82f6, #0ea5e9);
          border: 2px solid #1e293b;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #2563eb, #0284c7);
        }

        /* Firefox Scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: #3b82f6 #f1f5f9;
        }

        .dark * {
          scrollbar-color: #3b82f6 #1e293b;
        }
      `}</style>
    </div>
  )
}

export default Admin
