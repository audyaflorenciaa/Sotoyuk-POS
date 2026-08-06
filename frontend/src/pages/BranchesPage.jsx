import { useState, useEffect } from 'react'
import { branchAPI } from '../api'
import { Plus, Pencil, Trash2, X, MapPin } from 'lucide-react'

export default function BranchesPage() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editBranch, setEditBranch] = useState(null)
  const [form, setForm] = useState({ name: '', address: '' })

  const load = () => {
    setLoading(true)
    branchAPI.list().then((r) => {
      setBranches(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditBranch(null)
    setForm({ name: '', address: '' })
    setShowForm(true)
  }

  const openEdit = (b) => {
    setEditBranch(b)
    setForm({ name: b.name, address: b.address || '' })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editBranch) {
        await branchAPI.update(editBranch.id, form)
      } else {
        await branchAPI.create(form)
      }
      setShowForm(false)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menyimpan cabang')
    }
  }

  const handleDelete = async (b) => {
    if (!confirm(`Hapus cabang "${b.name}"?`)) return
    try {
      await branchAPI.delete(b.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus cabang')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cabang</h1>
          <p className="text-slate-500 text-sm">Kelola cabang toko</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> Tambah Cabang
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Memuat...</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Belum ada cabang</div>
      ) : (
        <div className="grid gap-4">
          {branches.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-700 font-bold text-sm">
                    {b.id}
                  </span>
                  <h3 className="font-semibold text-slate-800">{b.name}</h3>
                </div>
                {b.address && (
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1 ml-10">
                    <MapPin size={12} /> {b.address}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(b)}
                  className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(b)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {editBranch ? 'Edit Cabang' : 'Tambah Cabang'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Cabang</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  placeholder="Contoh: Cabang Baru"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  placeholder="Opsional"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 py-2 rounded-lg text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
