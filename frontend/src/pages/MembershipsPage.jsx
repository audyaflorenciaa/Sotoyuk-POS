import { useState, useEffect } from 'react'
import { membershipAPI, customerAPI } from '../api'
import { Plus, Edit2, Trash2, X, Gift, Search, Coins, History } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function MembershipsPage() {
  const [tab, setTab] = useState('tiers')
  const [tiers, setTiers] = useState([])
  const [members, setMembers] = useState([])
  const [customers, setCustomers] = useState([])
  const [showTierForm, setShowTierForm] = useState(false)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const loadTiers = async () => {
    const r = await membershipAPI.tiers.list()
    setTiers(r.data)
  }

  const loadMembers = async (q = '') => {
    const r = await membershipAPI.members.list(q ? { search: q } : {})
    setMembers(r.data)
  }

  useEffect(() => {
    loadTiers()
    customerAPI.list().then((r) => setCustomers(r.data))
  }, [])

  useEffect(() => {
    loadMembers(search)
  }, [search])

  useEffect(() => {
    if (tab === 'members') loadMembers()
  }, [tab])

  // --- Tier handlers ---
  const openTierCreate = () => {
    setEditItem(null)
    setForm({ name: '', point_rate: 0, discount_percent: 0, minimum_spend: 0, is_active: true })
    setShowTierForm(true)
    setError('')
  }

  const openTierEdit = (t) => {
    setEditItem({ kind: 'tier', data: t })
    setForm({ name: t.name, point_rate: t.point_rate, discount_percent: t.discount_percent, minimum_spend: t.minimum_spend, is_active: t.is_active })
    setShowTierForm(true)
    setError('')
  }

  const handleTierSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editItem) {
        await membershipAPI.tiers.update(editItem.data.id, form)
      } else {
        await membershipAPI.tiers.create(form)
      }
      setShowTierForm(false)
      loadTiers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal menyimpan')
    }
  }

  const handleTierDelete = async (id) => {
    if (!confirm('Hapus tier membership ini?')) return
    try {
      await membershipAPI.tiers.delete(id)
      loadTiers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus')
    }
  }

  // --- Member handlers ---
  const openMemberCreate = () => {
    setEditItem(null)
    setForm({ customer_id: '', tier_id: '', points: 0 })
    setShowMemberForm(true)
    setError('')
  }

  const openMemberEdit = (m) => {
    setEditItem({ kind: 'member', data: m })
    setForm({ customer_id: m.customer_id, tier_id: m.tier_id, points: m.points, is_active: m.is_active })
    setShowMemberForm(true)
    setError('')
  }

  const handleMemberSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const data = {
        customer_id: parseInt(form.customer_id),
        tier_id: form.tier_id ? parseInt(form.tier_id) : null,
        points: parseInt(form.points) || 0,
        is_active: form.is_active,
        expiry_at: form.expiry_at || null,
      }
      if (editItem) {
        await membershipAPI.members.update(editItem.data.id, data)
      } else {
        await membershipAPI.members.create(data)
      }
      setShowMemberForm(false)
      loadMembers(search)
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal menyimpan')
    }
  }

  const handleMemberDelete = async (id) => {
    if (!confirm('Hapus member ini?')) return
    try {
      await membershipAPI.members.delete(id)
      loadMembers(search)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus')
    }
  }

  const handleRedeem = async (m) => {
    const pts = parseInt(prompt(`Berikan poin redeem untuk ${m.customer?.name || m.member_code}?`, '100'))
    if (!pts || pts <= 0) return
    try {
      const r = await membershipAPI.members.redeem(m.id, pts)
      alert(`Redeem berhasil: ${r.data.points_used} poin = ${fmt(r.data.discount_rupiah)} diskon. Sisa: ${r.data.balance_after} poin`)
      loadMembers(search)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal redeem')
    }
  }

  const tierName = (id) => tiers.find((t) => t.id === id)?.name || '-'

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Membership</h1>
        {tab === 'tiers' && (
          <button
            onClick={openTierCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <Plus size={16} /> Tambah Tier
          </button>
        )}
        {tab === 'members' && (
          <button
            onClick={openMemberCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <Plus size={16} /> Tambah Member
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('tiers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'tiers' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          Tier
        </button>
        <button
          onClick={() => setTab('members')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'members' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          Member
        </button>
      </div>

      {/* TIERS */}
      {tab === 'tiers' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiers.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-100 text-amber-600 rounded-lg p-2"><Gift size={20} /></div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{t.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">Rate: {t.point_rate} poin/Rupiah</p>
                      <p className="text-xs text-slate-500">Min. belanja: {fmt(t.minimum_spend)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openTierEdit(t)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={16} /></button>
                    <button onClick={() => handleTierDelete(t.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className={`mt-2 text-xs px-2 py-1 rounded ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                  {t.is_active ? 'Aktif' : 'Non-aktif'}
                </div>
              </div>
            ))}
          </div>
          {tiers.length === 0 && (
            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
              <Gift size={48} className="mx-auto mb-2 opacity-30" />
              <p>Belum ada tier</p>
            </div>
          )}
        </>
      )}

      {/* MEMBERS */}
      {tab === 'members' && (
        <>
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Cari nama member / customer..."
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Kode</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Tier</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Poin</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.member_code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{m.customer?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{tierName(m.tier_id)}</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-600">{m.points}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => membershipAPI.members.points(m.id).then(() => alert('Cek detail'))} className="text-purple-500 hover:text-purple-700 mx-1 p-1" title="Riwayat Poin">
                          <History size={16} />
                        </button>
                        <button onClick={() => handleRedeem(m)} className="text-green-500 hover:text-green-700 mx-1 p-1" title="Redeem Poin">
                          <Coins size={16} />
                        </button>
                        <button onClick={() => openMemberEdit(m)} className="text-blue-500 hover:text-blue-700 mx-1 p-1">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleMemberDelete(m.id)} className="text-red-500 hover:text-red-700 mx-1 p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {members.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Gift size={48} className="mx-auto mb-2 opacity-30" />
                <p>Tidak ada member</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tier Form Modal */}
      {showTierForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editItem && editItem.kind === 'tier' ? 'Edit Tier' : 'Tambah Tier'}</h3>
              <button onClick={() => setShowTierForm(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
            <form onSubmit={handleTierSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Tier</label>
                <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Point Rate (per Rupiah)</label>
                <input type="number" step="0.001" value={form.point_rate || 0} onChange={(e) => setForm({ ...form, point_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Diskon Khusus (%)</label>
                <input type="number" step="0.1" value={form.discount_percent || 0} onChange={(e) => setForm({ ...form, discount_percent: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Belanja</label>
                <input type="number" value={form.minimum_spend || 0} onChange={(e) => setForm({ ...form, minimum_spend: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} id="tier_active" />
                <label htmlFor="tier_active" className="text-sm text-slate-700">Aktif</label>
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors">
                {editItem && editItem.kind === 'tier' ? 'Simpan' : 'Tambah'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Member Form Modal */}
      {showMemberForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editItem && editItem.kind === 'member' ? 'Edit Member' : 'Tambah Member'}</h3>
              <button onClick={() => setShowMemberForm(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <select value={form.customer_id || ''} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required disabled={editItem && editItem.kind === 'member'}>
                  <option value="">Pilih Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tier</label>
                <select value={form.tier_id || ''} onChange={(e) => setForm({ ...form, tier_id: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Tanpa Tier</option>
                  {tiers.filter((t) => t.is_active).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Point Awal</label>
                <input type="number" value={form.points || 0} onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              {editItem && editItem.kind === 'member' && (
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} id="member_active" />
                  <label htmlFor="member_active" className="text-sm text-slate-700">Aktif</label>
                </div>
              )}
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors">
                {editItem && editItem.kind === 'member' ? 'Simpan' : 'Tambah'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
