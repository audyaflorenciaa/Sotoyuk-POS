import { useState, useEffect } from 'react'
import { userAPI, branchAPI } from '../api'
import { Plus, Edit2, Trash2, X, Users, Shield } from 'lucide-react'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ username: '', full_name: '', email: '', password: '', role: 'kasir', branch_id: '' })
  const [error, setError] = useState('')
  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))

  const load = async () => {
    const r = await userAPI.list()
    setUsers(r.data)
  }

  useEffect(() => {
    load()
    if (currentUser.role === 'superadmin') {
      branchAPI.list().then((r) => setBranches(r.data)).catch(() => {})
    }
  }, [])

  const openCreate = () => {
    setEditItem(null)
    const defaultBranch = currentUser.role !== 'superadmin' ? currentUser.branch_id : ''
    setForm({ username: '', full_name: '', email: '', password: '', role: 'kasir', branch_id: defaultBranch || '' })
    setShowForm(true)
    setError('')
  }

  const openEdit = (u) => {
    setEditItem(u)
    setForm({ username: u.username, full_name: u.full_name || '', email: u.email || '', password: '', role: u.role, branch_id: u.branch_id || '' })
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const data = { ...form }
      if (editItem && !data.password) delete data.password
      if (data.branch_id === '' || data.branch_id === undefined) {
        delete data.branch_id
      } else {
        data.branch_id = Number(data.branch_id)
      }
      if (editItem) {
        await userAPI.update(editItem.id, data)
      } else {
        await userAPI.create(data)
      }
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal menyimpan')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus user ini?')) return
    try {
      await userAPI.delete(id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus')
    }
  }

  const roleColor = {
    superadmin: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    kasir: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">User</h1>
        <button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={16} /> Tambah User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Username</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nama Lengkap</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.username}</td>
                  <td className="px-4 py-3 text-slate-600">{u.full_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor[u.role] || ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openEdit(u)} className="text-blue-500 hover:text-blue-700 mx-1">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 mx-1">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editItem ? 'Edit User' : 'Tambah User'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password {editItem && '(kosongkan jika tidak diubah)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  required={!editItem}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="kasir">Kasir</option>
                  <option value="admin">Admin</option>
                  {currentUser.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                </select>
              </div>
              {currentUser.role === 'superadmin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cabang</label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Tidak ada cabang (superadmin)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
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