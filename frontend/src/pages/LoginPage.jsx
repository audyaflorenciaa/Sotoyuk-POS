import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'
import { applyBrandSettings } from '../utils/brand'
import { applyTheme } from '../utils/theme'
import { Lock, User, AlertCircle, Building2 } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [storeName, setStoreName] = useState('POS')
  const [storeLogo, setStoreLogo] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Apply cached theme first
    const cachedTheme = localStorage.getItem('store_theme_settings')
    if (cachedTheme) {
      try { applyTheme(JSON.parse(cachedTheme)) } catch {}
    }

    api.get('/public/store-info').then((r) => {
      const data = r.data || {}
      if (data.store_name) setStoreName(data.store_name)
      if (data.store_logo) setStoreLogo(data.store_logo.startsWith('/') ? data.store_logo : `/${data.store_logo}`)
      applyBrandSettings(data)
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const userData = await login(username, password)
      if (userData.branch) {
        localStorage.setItem('branch_name', userData.branch.name)
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
            {storeLogo ? (
              <img src={storeLogo} alt={storeName} className="w-full h-full object-contain" />
            ) : (
              <span className="text-3xl font-bold text-white">K</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{storeName}</h1>
          <p className="text-slate-500 text-sm mt-1">F&B Point of Sale</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                placeholder="Masukkan username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                placeholder="Masukkan password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-500 text-center">
          <p className="font-medium mb-1">Demo Accounts:</p>
          <p>superadmin / superadmin</p>
          <p>admin_utama / admin &bull; kasir_utama / kasir1</p>
          <p>admin_dago / admin &bull; kasir_dago / kasir1</p>
        </div>
      </div>
    </div>
  )
}