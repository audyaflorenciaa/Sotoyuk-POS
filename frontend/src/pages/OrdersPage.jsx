import { useState, useEffect } from 'react'
import { orderAPI, branchAPI } from '../api'
import { useAuth } from '../AuthContext'
import { Eye, X, Trash2, AlertCircle, ClipboardList, Building2, Calendar } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function OrdersPage() {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('')
  const [detail, setDetail] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const buildParams = (status = filter) => {
    const params = {}
    if (status) params.status = status
    if (isSuperadmin && branchFilter) params.branch_id = branchFilter
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return params
  }

  const load = async (status = filter) => {
    const r = await orderAPI.list(buildParams(status))
    setOrders(r.data)
  }

  useEffect(() => {
    load()
    if (isSuperadmin) {
      branchAPI.list().then((r) => setBranches(r.data))
    }
  }, [])

  const handleFilter = (s) => {
    setFilter(s)
    load(s)
  }

  const handleBranchFilter = (id) => {
    setBranchFilter(id)
    const params = buildParams(filter)
    if (id) params.branch_id = id
    else delete params.branch_id
    orderAPI.list(params).then((r) => setOrders(r.data))
  }

  const applyDateFilter = (from, to) => {
    const params = buildParams(filter)
    if (from) params.date_from = from
    if (to) params.date_to = to
    orderAPI.list(params).then((r) => setOrders(r.data))
  }

  const handleVoid = async (id) => {
    if (!confirm('Yakin void order ini? Stok akan dikembalikan.')) return
    try {
      await orderAPI.void(id)
      load(filter)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal void')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus order ini?')) return
    try {
      await orderAPI.delete(id)
      load(filter)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus')
    }
  }

  const statusColor = {
    open: 'bg-blue-100 text-blue-700',
    paid: 'bg-emerald-100 text-emerald-700',
    void: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Riwayat Order</h1>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-2">
          {[
            { key: '', label: 'Semua' },
            { key: 'open', label: 'Terbuka' },
            { key: 'paid', label: 'Dibayar' },
            { key: 'void', label: 'Void' },
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

        {isSuperadmin && (
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <select
              value={branchFilter}
              onChange={(e) => handleBranchFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            >
              <option value="">Semua Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); applyDateFilter(e.target.value, dateTo) }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-slate-500 text-sm">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); applyDateFilter(dateFrom, e.target.value) }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">No. Order</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tanggal</th>
                {isSuperadmin && <th className="text-left px-4 py-3 font-medium text-slate-600">Cabang</th>}
                <th className="text-center px-4 py-3 font-medium text-slate-600">Meja</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Bayar</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{o.order_number}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {o.created_at ? new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                  </td>
                  {isSuperadmin && (
                    <td className="px-4 py-3 text-slate-600">
                      {o.branch ? o.branch.name : '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">{o.table ? `#${o.table.number}` : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[o.status] || ''}`}>
                      {o.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{o.payment_method?.toUpperCase() || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">{fmt(o.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setDetail(o)} className="text-blue-500 hover:text-blue-700 mx-1">
                      <Eye size={16} />
                    </button>
                    {o.status === 'open' && (
                      <button onClick={() => handleVoid(o.id)} className="text-orange-500 hover:text-orange-700 mx-1">
                        <AlertCircle size={16} />
                      </button>
                    )}
                    {o.status !== 'paid' && (
                      <button onClick={() => handleDelete(o.id)} className="text-red-500 hover:text-red-700 mx-1">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <ClipboardList size={48} className="mx-auto mb-2 opacity-30" />
            <p>Belum ada order</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Detail Order</h3>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">No. Order</span>
                  <p className="font-mono font-medium">{detail.order_number}</p>
                </div>
                <div>
                  <span className="text-slate-500">Status</span>
                  <p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[detail.status] || ''}`}>
                      {detail.status?.toUpperCase()}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Tanggal</span>
                  <p>{detail.created_at ? new Date(detail.created_at).toLocaleString('id-ID') : '-'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Meja</span>
                  <p>{detail.table ? `#${detail.table.number} ${detail.table.name || ''}` : '-'}</p>
                </div>
                {isSuperadmin && (
                  <div>
                    <span className="text-slate-500">Cabang</span>
                    <p>{detail.branch?.name || '-'}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Items</p>
                {detail.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1">
                    <span>{item.product_name} x{item.qty}</span>
                    <span>{fmt(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{fmt(detail.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Diskon</span>
                  <span>{fmt(detail.discount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PPN 11%</span>
                  <span>{fmt(detail.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total</span>
                  <span className="text-amber-600">{fmt(detail.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Bayar</span>
                  <span>{detail.payment_method?.toUpperCase() || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}