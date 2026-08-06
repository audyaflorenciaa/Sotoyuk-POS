import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { settingAPI } from './api'
import { applyBrandSettings } from './utils/brand'
import { applyTheme } from './utils/theme'
import {
  LayoutDashboard, ShoppingCart, Package, Grid3X3, Table2, CreditCard,
  ClipboardList, BarChart3, Users, Settings, LogOut, Menu, X, Receipt,
  Gift, Building2
} from 'lucide-react'
import BranchSwitcher from './components/BranchSwitcher'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['superadmin', 'admin', 'kasir'] },
  { to: '/pos', icon: ShoppingCart, label: 'POS / Kasir', roles: ['superadmin', 'admin', 'kasir'] },
  { to: '/products', icon: Package, label: 'Produk', roles: ['superadmin', 'admin'] },
  { to: '/categories', icon: Grid3X3, label: 'Kategori', roles: ['superadmin', 'admin'] },
  { to: '/tables', icon: Table2, label: 'Meja', roles: ['superadmin', 'admin'] },
  { to: '/memberships', icon: Gift, label: 'Membership', roles: ['superadmin', 'admin'] },
  { to: '/orders', icon: ClipboardList, label: 'Riwayat Order', roles: ['superadmin', 'admin', 'kasir'] },
  { to: '/reports', icon: BarChart3, label: 'Laporan', roles: ['superadmin', 'admin'] },
  { to: '/users', icon: Users, label: 'User', roles: ['superadmin'] },
  { to: '/branches', icon: Building2, label: 'Cabang', roles: ['superadmin'] },
  { to: '/settings', icon: Settings, label: 'Setting', roles: ['superadmin', 'admin'] },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [storeName, setStoreName] = useState('POS')
  const [storeLogo, setStoreLogo] = useState('')

  useEffect(() => {
    settingAPI.list().then((r) => {
      const settings = {}
      r.data.forEach((s) => { settings[s.key] = s.value || '' })
      const name = settings.store_name
      const logo = settings.store_logo
      if (name) setStoreName(name)
      if (logo) setStoreLogo(logo.startsWith('/') ? logo : `/${logo}`)
      applyBrandSettings(settings)
      applyTheme(settings)
    }).catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filteredNav = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--body-bg)' }}>
      {/* Sidebar */}
      <aside
        className={`flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
        style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              {storeLogo ? (
                <img src={storeLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <span className="text-2xl font-bold" style={{ color: 'var(--sidebar-active)' }}>K</span>
              )}
              <span className="text-lg font-bold" style={{ color: 'var(--sidebar-active)' }}>{storeName}</span>
            </div>
          )}
          {!sidebarOpen && storeLogo && (
            <img src={storeLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain mx-auto" />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:opacity-80 transition-opacity"
            style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'border-r-2'
                    : 'hover:bg-white/10'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--sidebar-active-bg)' : undefined,
                color: isActive ? 'var(--sidebar-active)' : 'var(--sidebar-text)',
                opacity: isActive ? 1 : 0.7,
                borderColor: isActive ? 'var(--sidebar-active)' : undefined,
              })}
            >
              <item.icon size={20} />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Branch Switcher */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-t border-white/10">
            <BranchSwitcher />
          </div>
        )}

        {/* User info */}
        <div className="border-t border-white/10 p-3">
          {sidebarOpen && (
            <div className="text-xs mb-2 truncate" style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>
              {user?.full_name || user?.username}
              <br />
              <span style={{ color: 'var(--sidebar-active)' }}>{user?.role}</span>
              {user?.branch && (
                <>
                  <br />
                  <span style={{ opacity: 0.5 }}>{user.branch.name}</span>
                </>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm w-full hover:text-red-400 transition-colors"
            style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}
          >
            <LogOut size={18} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--body-bg)' }}>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
