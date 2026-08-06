import { useState, useEffect } from 'react'
import { reportAPI, userAPI } from '../api'
import { BarChart3, TrendingUp, AlertTriangle, DollarSign, ShoppingCart, Package, Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444']

export default function ReportsPage() {
  const [summary, setSummary] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [daily, setDaily] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reportType, setReportType] = useState('daily') // 'daily', 'monthly', 'cashier'
  const [cashiers, setCashiers] = useState([])
  const [selectedCashierId, setSelectedCashierId] = useState('')

  useEffect(() => {
    reportAPI.summary().then((r) => setSummary(r.data))
    reportAPI.topProducts({ limit: 10 }).then((r) => setTopProducts(r.data))
    reportAPI.lowStock().then((r) => setLowStock(r.data))
    userAPI.list().then((r) => setCashiers(r.data.filter(u => ['kasir', 'admin', 'superadmin'].includes(u.role))))
  }, [])

  useEffect(() => {
    reportAPI.daily({ date_from: dateFrom, date_to: dateTo }).then((r) => setDaily(r.data))
  }, [dateFrom, dateTo])

  const handleDownloadReport = async () => {
    let response
    const params = { date_from: dateFrom, date_to: dateTo }
    if (selectedCashierId) {
      params.cashier_id = selectedCashierId
    }

    try {
      if (reportType === 'daily') {
        response = await reportAPI.downloadDaily(params)
      } else if (reportType === 'monthly') {
        response = await reportAPI.downloadMonthly(params)
      } else if (reportType === 'cashier') {
        response = await reportAPI.downloadCashier(params)
      } else {
        return alert('Pilih jenis laporan untuk diunduh.')
      }

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const filename = response.headers['content-disposition']?.split('filename=')[1] || `laporan_${reportType}.xlsx`
      link.setAttribute('download', filename.replace(/"/g, '')) // Remove quotes
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Gagal mengunduh laporan: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handlePresetDateRange = (type) => {
    const today = new Date()
    let from, to
    if (type === 'today') {
      from = today
      to = today
    } else if (type === 'last_7_days') {
      from = subDays(today, 6)
      to = today
    } else if (type === 'this_month') {
      from = startOfMonth(today)
      to = endOfMonth(today)
    } else if (type === 'last_month') {
      const lastMonth = subDays(startOfMonth(today), 1)
      from = startOfMonth(lastMonth)
      to = endOfMonth(lastMonth)
    }
    setDateFrom(format(from, 'yyyy-MM-dd'))
    setDateTo(format(to, 'yyyy-MM-dd'))
  }

  if (!summary) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Memuat data...</div>
  }

  const paymentData = Object.entries(summary.by_payment_method || {}).map(([k, v]) => ({
    name: k.toUpperCase(),
    value: v,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Laporan</h1>

      {/* Report Filters and Download */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Laporan</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="daily">Harian (Excel)</option>
              <option value="monthly">Bulanan (Excel)</option>
              <option value="cashier">Per Kasir (Excel)</option>
            </select>
          </div>
          {reportType === 'cashier' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Kasir</label>
              <select
                value={selectedCashierId}
                onChange={(e) => setSelectedCashierId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Semua Kasir</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>{cashier.full_name || cashier.username}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => handlePresetDateRange('today')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium">Hari Ini</button>
          <button onClick={() => handlePresetDateRange('last_7_days')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium">7 Hari Terakhir</button>
          <button onClick={() => handlePresetDateRange('this_month')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium">Bulan Ini</button>
          <button onClick={() => handlePresetDateRange('last_month')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium">Bulan Lalu</button>
          <button
            onClick={handleDownloadReport}
            className="ml-auto bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <Download size={16} /> Unduh Laporan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 text-emerald-600 rounded-lg p-2">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Pendapatan</p>
              <p className="text-lg font-bold text-slate-800">{fmt(summary.total_revenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-600 rounded-lg p-2">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Order</p>
              <p className="text-lg font-bold text-slate-800">{summary.total_orders}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 text-purple-600 rounded-lg p-2">
              <Package size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Items Terjual</p>
              <p className="text-lg font-bold text-slate-800">{summary.total_items}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 text-amber-600 rounded-lg p-2">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Rata-rata per Order</p>
              <p className="text-lg font-bold text-slate-800">{fmt(summary.avg_order)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Pendapatan Harian (30 Hari)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(8)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Method Pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Metode Pembayaran</h2>
          {paymentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {paymentData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-slate-500">Tidak ada data</div>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Top 10 Produk Terlaris</h2>
          <div className="space-y-2">
            {topProducts.map((p, idx) => (
              <div key={p.product_id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-400 w-6">{idx + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.qty_sold} terjual &bull; {fmt(p.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            Stok Menipis (&lt;10)
          </h2>
          <div className="space-y-2">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.sku}</p>
                </div>
                <span className={`text-sm font-bold ${p.stock < 5 ? 'text-red-600' : 'text-amber-600'}`}>
                  {p.stock}
                </span>
              </div>
            ))}
            {lowStock.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Semua stok aman</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
