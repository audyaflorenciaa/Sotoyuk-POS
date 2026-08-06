import { useState, useEffect } from 'react'
import { tableAPI } from '../api'
import { useAuth } from '../AuthContext'
import { Plus, Edit2, Trash2, X, Table2 } from 'lucide-react'

export default function TablesPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin'
  const isKasir = user?.role === 'kasir'
  const canEditTables = isSuperadmin || isAdmin
  const [tables, setTables] = useState([])
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ number: '', name: '', capacity: '4', status: 'available' })
  const [error, setError] = useState('')

  const load = async (status = '') => {
    const r = await tableAPI.list(status || undefined)
    setTables(r.data)
  }

  useEffect(() => { load() }, [])

  const handleFilter = (status) => {
    setFilter(status)
    load(status)
  }

  const openCreate = () => {
    setEditItem(null)
    setForm({ number: '', name: '', capacity: '4', status: 'available' })
    setShowForm(true)
    setError('')
  }

  const openEdit = (t) => {
    setEditItem(t)
    setForm({ number: t.number, name: t.name || '', capacity: String(t.capacity), status: t.status || 'available' })
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const data = { ...form, capacity: parseInt(form.capacity) || 4 }
      if (editItem) {
        await tableAPI.update(editItem.id, data)
      } else {
        await tableAPI.create(data)
      }
      setShowForm(false)
      load(filter)
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal menyimpan')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus meja ini?')) return
    try {
      await tableAPI.delete(id)
      load(filter)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus')
    }
  }

  const handleStatus = async (id, status) => {
    try {
      await tableAPI.updateStatus(id, status)
      load(filter)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal mengubah status')
    }
  }

  const statusColor = {
    available: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    occupied: 'bg-red-100 text-red-700 border-red-200',
    reserved: 'bg-amber-100 text-amber-700 border-amber-200',
    cleaning: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  const statusLabel = { available: 'Tersedia', occupied: 'Terisi', reserved: 'Direservasi', cleaning: 'Dibersihkan' }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Meja</h1>
        {canEditTables && (
          <button
            onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <Plus size={16} /> Tambah Meja
          </button>
        )}
      </div>

      <div className="flex gap-2">
      {[
        { key: '', label: 'Semua' },
        { key: 'available', label: 'Tersedia' },
        { key: 'occupied', label: 'Terisi' },
        { key: 'reserved', label: 'Direservasi' },
        { key: 'cleaning', label: 'Dibersihkan' },
      ].map((s) => (
          <button
            key={s.key}
            onClick={() => handleFilter(s.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === s.key
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {tables.map((t) => (
          <div
            key={t.id}
            className={`bg-white rounded-xl border-2 p-4 text-center hover:shadow-md transition-all ${
              statusColor[t.status] || 'border-slate-200'
            }`}
          >
            <Table2 size={32} className="mx-auto mb-2 opacity-60" />
            <p className="text-2xl font-bold">#{t.number}</p>
            <p className="text-sm mt-1">{t.name || 'Meja'}</p>
            <p className="text-xs mt-1">{t.capacity} orang</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-white/60">
              {statusLabel[t.status] || t.status}
            </span>
            <div className="flex flex-col gap-1 mt-3">
              {(t.status === 'occupied' || t.status === 'reserved' || t.status === 'cleaning') && (
                <button onClick={() => handleStatus(t.id, 'available')} className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium" title="Buka meja">
                  Buka Meja
                </button>
              )}
              {canEditTables && t.status === 'available' && (
                <button onClick={() => handleStatus(t.id, 'reserved')} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-medium" title="Reservasi">
                  Reservasi
                </button>
              )}
              {canEditTables && (
                <div className="flex justify-center gap-1 mt-1">
                  <button onClick={() => openEdit(t)} className="text-blue-500 hover:text-blue-700 p-1" title="Edit">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700 p-1" title="Hapus">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editItem ? 'Edit Meja' : 'Tambah Meja'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Meja</label>
                  <input
                    type="text"
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kapasitas</label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="available">Tersedia</option>
                  <option value="occupied">Terisi</option>
                  <option value="reserved">Direservasi</option>
                  <option value="cleaning">Dibersihkan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama / Lokasi</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Contoh: VIP, Tengah, Depan"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {editItem ? 'Simpan' : 'Tambah'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}