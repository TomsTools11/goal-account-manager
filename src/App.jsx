import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Search, CheckSquare, ScanLine, FolderOpen,
  PlusCircle, Settings, Menu, X, ChevronRight
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Tasks from './pages/Tasks';
import Scanner from './pages/Scanner';
import SearchPage from './pages/SearchPage';
import AddAccount from './pages/AddAccount';
import SettingsPage from './pages/SettingsPage';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/accounts', icon: Users, label: 'Accounts' },
  { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { path: '/scanner', icon: ScanLine, label: 'Scanner' },
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/add', icon: PlusCircle, label: 'Add Account' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 bg-brand-surface border-r border-brand-border flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-brand-border gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-text-muted hover:text-text-primary transition-colors">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-blue rounded-lg flex items-center justify-center">
                <span className="text-white font-display font-bold text-sm">G</span>
              </div>
              <span className="font-display font-semibold text-text-primary text-sm">Account Manager</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-blue/15 text-brand-blue font-medium'
                    : 'text-text-muted hover:bg-brand-elevated hover:text-text-primary'
                }`
              }
            >
              <Icon size={18} />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="p-3 border-t border-brand-border">
            <div className="text-caption text-text-dim">GOAL Account Manager v1.0</div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex items-center px-6 border-b border-brand-border bg-brand-surface/50 backdrop-blur-sm gap-4">
          <form onSubmit={handleGlobalSearch} className="flex-1 max-w-xl">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                placeholder="Search across all sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full pl-9 pr-4 py-1.5 text-sm"
              />
            </div>
          </form>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <div className="w-2 h-2 rounded-full bg-brand-success animate-pulse" />
            Connected
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:id" element={<AccountDetail />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/add" element={<AddAccount />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
