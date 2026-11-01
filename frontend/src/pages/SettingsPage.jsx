import { useState, useEffect } from 'react'
import { settingAPI } from '../api'
import api from '../api'
import { saveBrandSettingsToCache } from '../utils/brand'
import { saveThemeSettingsToCache } from '../utils/theme'
import { Settings, Save, Check, Upload, Image } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState([])
  const [form, setForm] = useState({})
  const [saved, setSaved] = useState(false)
  const [logoPreview, setLogoPreview] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    const r = await settingAPI.list()
    setSettings(r.data)
    const f = {}
    r.data.forEach((s) => { f[s.key] = s.value || '' })
    setForm(f)
    if (f.store_logo) {
      setLogoPreview(f.store_logo.startsWith('/') ? f.store_logo : `/${f.store_logo}`)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    for (const [key, value] of Object.entries(form)) {
      await settingAPI.upsert({ key, value })
    }
    saveBrandSettingsToCache(form)
    saveThemeSettingsToCache(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/upload/logo', fd, {
        headers: { 'Content-Type': undefined },
      })
      const url = r.data.url
      setForm({ ...form, store_logo: url })
      setLogoPreview(url)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal upload logo')
    } finally {
      setUploading(false)
    }
  }

  const settingFields = [
    { key: 'store_name', label: 'Nama Toko', type: 'text' },
    { key: 'store_address', label: 'Alamat', type: 'text' },
    { key: 'store_phone', label: 'Telepon', type: 'text' },
    { key: 'service_charge', label: 'Service Charge (%)', type: 'number' },
    { key: 'receipt_footer', label: 'Footer Struk', type: 'text' },
    { key: 'currency', label: 'Mata Uang', type: 'text' },
    { key: 'opening_time', label: 'Jam Buka', type: 'time' },
    { key: 'closing_time', label: 'Jam Tutup', type: 'time' },
  ]

  const themeFields = [
    { key: 'primary_color', label: 'Warna Utama (Tombol/Highlight)', default: '#f59e0b' },
    { key: 'sidebar_bg', label: 'Background Sidebar', default: '#0f172a' },
    { key: 'sidebar_text', label: 'Teks Sidebar', default: '#ffffff' },
    { key: 'sidebar_active', label: 'Warna Aktif Sidebar', default: '#fbbf24' },
    { key: 'body_bg', label: 'Background Halaman', default: '#f1f5f9' },
  ]

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Setting</h1>

      {/* Logo Upload */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Logo Toko</h2>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Image size={32} className="text-slate-300" />
            )}
          </div>
          <div>
            <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium cursor-pointer transition-colors">
              <Upload size={16} />
              {uploading ? 'Upload...' : 'Pilih Logo'}
              <input type="file" accept="image/*" hidden onChange={handleLogoUpload} disabled={uploading} />
            </label>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG (maks 2MB)</p>
          </div>
        </div>
      </div>

      {/* Settings Fields */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        {settingFields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
            <input
              type={field.type}
              value={form[field.key] || ''}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        ))}
      </div>

      {/* Theme / Color */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Tema / Warna Aplikasi</h2>
        <p className="text-xs text-slate-500 mb-3">Khusus superadmin. Klik kotak warna untuk mengganti.</p>
        <div className="grid grid-cols-2 gap-4">
          {themeFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form[field.key] || field.default}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0"
                />
                <span className="text-xs font-mono text-slate-500">{form[field.key] || field.default}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'text-white'
        }`}
        style={saved ? {} : { background: 'var(--primary-color)' }}
        onMouseEnter={(e) => { if (!saved) e.currentTarget.style.background = 'var(--primary-hover)' }}
        onMouseLeave={(e) => { if (!saved) e.currentTarget.style.background = 'var(--primary-color)' }}
      >
        {saved ? <Check size={18} /> : <Save size={18} />}
        {saved ? 'Tersimpan!' : 'Simpan Setting'}
      </button>
    </div>
  )
}