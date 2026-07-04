import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, List, Cpu, Skull,
  RefreshCw, Settings, LogOut, Zap,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { wsClient } from '../lib/websocket';
import { useEffect } from 'react';
import { clsx } from 'clsx';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/workers', label: 'Workers', icon: Cpu },
  { to: '/dlq', label: 'Dead Letter Queue', icon: Skull },
  { to: '/retry-policies', label: 'Retry Policies', icon: RefreshCw },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 flex items-center gap-2 border-b border-gray-800">
          <Zap className="text-blue-500" size={22} />
          <span className="font-bold text-white text-lg">JobScheduler</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 w-full transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
