import { useState, useEffect } from 'react'
import { dashboardAPI } from '../api'
import { useAuth } from '../AuthContext'
import {
  DollarSign, ShoppingCart, Package, Users, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    dashboardAPI.stats().then((r) => setStats(r.data))
  }, [])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Memuat data...</div>
      </div>
    )
  }

  const cards = [
    { label: 'Pendapatan Hari Ini', value: fmt(stats.today_revenue), icon: DollarSign, color: 'bg-emerald-500' },
    { label: 'Order Hari Ini', value: stats.today_orders, icon: ShoppingCart, color: 'bg-blue-500' },
    { label: 'Items Terjual', value: stats.today_items, icon: Package, color: 'bg-purple-500' },
    { label: 'Order Terbuka', value: stats.open_orders, icon: TrendingUp, color: 'bg-amber-500' },
    { label: 'Stok Menipis', value: stats.low_stock, icon: AlertTriangle, color: 'bg-red-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm">Selamat datang, {user?.full_name || user?.username}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`${c.color} text-white rounded-lg p-2`}>
                <c.icon size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{c.label}</p>
                <p className="text-xl font-bold text-slate-800">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Pendapatan 7 Hari Terakhir</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.revenue_7d}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}