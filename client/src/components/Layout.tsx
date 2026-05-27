import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  GanttChart,
  Calendar,
  GitBranch,
  Mail,
  LogOut,
  Zap,
  BookOpen,
  Bug,
  Rocket,
  Target,
  LayoutDashboard,
  ClipboardList
} from 'lucide-react'

const dataPages = [
  { to: '/stories', icon: BookOpen, label: 'Stories' },
  { to: '/sprint-goals', icon: Target, label: 'Sprint Goals' },
  { to: '/releases', icon: Rocket, label: 'Releases' },
  { to: '/bugs', icon: Bug, label: 'Bugs' },
]

const vizPages = [
  { to: '/gantt', icon: GanttChart, label: 'Gantt Chart' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/dependencies', icon: GitBranch, label: 'Dependencies' },
  { to: '/email', icon: Mail, label: 'Executive Email' },
]

export default function Layout() {
  const { username, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#76B900]" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Mission Control</h1>
              <p className="text-xs text-gray-500">OMPE Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Dashboard */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-[#76B900]/10 text-[#76B900]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </NavLink>

          {/* Daily Tasks */}
          <NavLink
            to="/daily-tasks"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-[#76B900]/10 text-[#76B900]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <ClipboardList className="w-4 h-4" />
            Daily Tasks
          </NavLink>

          {/* Data Pages */}
          <div>
            <p className="px-3 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data Views</p>
            <div className="space-y-0.5">
              {dataPages.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-[#76B900]/10 text-[#76B900]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Visualization Pages */}
          <div>
            <p className="px-3 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visualizations</p>
            <div className="space-y-0.5">
              {vizPages.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-[#76B900]/10 text-[#76B900]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium text-gray-700">{username}</p>
              <p className="text-xs text-gray-400">Connected to Jira</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
