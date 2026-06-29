import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  Calendar,
  Bell,
  User,
  ListPlus,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { DEMO, demoClient } from '../demo/demoData'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Home', to: '/', icon: <Home size={18} /> },
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Meetings', to: '/meetings', icon: <Calendar size={18} /> },
  { label: 'Notifications', to: '/notifications', icon: <Bell size={18} /> },
  { label: 'Wishlist', to: '/wishlist', icon: <ListPlus size={18} /> },
  { label: 'Profile', to: '/profile', icon: <User size={18} /> },
]

function roleBadgeLabel(role: string) {
  switch (role) {
    case 'COMPANY_ADMIN': return 'Company Admin'
    case 'SALES_HEAD': return 'Sales Head'
    case 'SALES_PERSON': return 'Sales Person'
    default: return role
  }
}

export default function PortalLayout() {
  const { portalUser, signOut } = usePortalAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-xl tracking-tight">Amplior</span>
          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
        </div>
        <p className="text-slate-400 text-xs mt-1">Client Portal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700',
                  ].join(' ')
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-slate-700">
        {portalUser && (
          <div className="mb-3">
            <p className="text-white text-sm font-medium truncate">
              {DEMO ? demoClient.adminName : `${portalUser.auth_uid.slice(0, 8)}…`}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              {DEMO ? `${demoClient.companyName} · ${demoClient.adminRole}` : roleBadgeLabel(portalUser.portal_role)}
            </p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg text-sm transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#EEF2FF]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 bg-[#0F172A] h-full">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-50 flex flex-col w-64 bg-[#0F172A] h-full shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-gray-800 text-base">Amplior</span>
          <NavLink to="/notifications" className="text-gray-600 hover:text-primary">
            <Bell size={22} />
          </NavLink>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
