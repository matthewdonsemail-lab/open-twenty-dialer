import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { signOut } from '@/lib/auth';
import {
  LayoutDashboard,
  Users,
  Target,
  FileText,
  Clock,
  Shield,
  Phone,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/campaigns', label: 'Campaigns', icon: Target },
  { to: '/scripts', label: 'Scripts', icon: FileText },
  { to: '/history', label: 'Call History', icon: Clock },
  { to: '/admin', label: 'Admin', icon: Shield },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isLeadDetail = location.pathname.startsWith('/leads/') && location.pathname !== '/leads';
  const currentNav = navItems.find((n) => location.pathname.startsWith(n.to));

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--ods-bg-secondary,#fafafb)] text-[var(--ods-text-primary,#18181b)] font-sans antialiased">
      {/* mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden ${
          sidebarOpen ? 'block' : 'hidden'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* twenty-style navigation drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-[var(--ods-bg-secondary,#fafafb)] border-r border-[var(--ods-border,#e5e5ea)] flex flex-col select-none transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* header: workspace dropdown trigger (28px height inside 40px container) */}
        <div className="flex items-center justify-between h-10 px-2 pt-1">
          <div className="flex items-center gap-2 h-7 px-1.5 rounded-[6px] hover:bg-black/[0.04] cursor-pointer transition-colors max-w-[calc(100%-32px)]">
            <div className="w-4 h-4 rounded-[4px] bg-[var(--ods-brand-600,#2563eb)] flex items-center justify-center flex-shrink-0">
              <Phone className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[13px] font-medium tracking-tight truncate text-[var(--ods-text-primary,#18181b)]">
              Cold Dialer
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--ods-text-tertiary,#8a8a93)] flex-shrink-0" />
          </div>

          <button
            className="lg:hidden p-1 text-[var(--ods-text-secondary,#575757)] hover:text-[var(--ods-text-primary,#18181b)]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* section title */}
        <div className="px-3 pt-3 pb-1">
          <span className="text-[11px] font-semibold text-[var(--ods-text-tertiary,#8a8a93)] tracking-wider uppercase">
            Workspace
          </span>
        </div>

        {/* navigation rows (strictly 28px height) */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2 h-7 rounded-[4px] text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-black/[0.06] text-[var(--ods-text-primary,#18181b)]'
                      : 'text-[var(--ods-text-secondary,#575757)] hover:bg-black/[0.04] hover:text-[var(--ods-text-primary,#18181b)]'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-[var(--ods-text-secondary,#71717a)]" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* compact user footer */}
        <div className="p-2 border-t border-[var(--ods-border,#e5e5ea)]">
          <div className="flex items-center justify-between h-8 px-2 rounded-[6px] hover:bg-black/[0.04] transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-[10px] font-medium text-[var(--ods-text-primary,#18181b)] flex-shrink-0">
                {(user?.user_metadata?.full_name ?? user?.email ?? 'U')[0].toUpperCase()}
              </div>
              <span className="text-[12px] font-medium text-[var(--ods-text-secondary,#575757)] truncate">
                {user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User'}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="text-[var(--ods-text-tertiary,#8a8a93)] hover:text-red-600 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* main content area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--ods-bg-primary,#ffffff)]">
        {/* twenty-style 40px top bar with dynamic breadcrumbs */}
        <header className="sticky top-0 z-30 bg-[var(--ods-bg-primary,#ffffff)] border-b border-[var(--ods-border,#e5e5ea)] h-10 flex items-center justify-between px-3 select-none">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1 text-[var(--ods-text-secondary,#575757)]"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* twenty breadcrumb trail */}
            <div className="flex items-center gap-1.5 text-[13px]">
              {isLeadDetail ? (
                <>
                  <button
                    onClick={() => navigate('/leads')}
                    className="flex items-center gap-1.5 text-[var(--ods-text-secondary,#575757)] hover:text-[var(--ods-text-primary,#18181b)] transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 opacity-70" />
                    <span>Leads</span>
                  </button>
                  <span className="text-[var(--ods-text-tertiary,#8a8a93)]">/</span>
                  <span className="font-semibold text-[var(--ods-text-primary,#18181b)]">
                    Lead Record
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-1.5 font-medium text-[var(--ods-text-primary,#18181b)]">
                  {currentNav && <currentNav.icon className="w-3.5 h-3.5 opacity-70 text-[var(--ods-text-secondary,#71717a)]" />}
                  <span>{currentNav?.label ?? 'Workspace'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="relative p-1 text-[var(--ods-text-secondary,#575757)] hover:text-[var(--ods-text-primary,#18181b)] hover:bg-black/[0.04] rounded-[4px] transition">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* content body */}
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--ods-bg-primary,#ffffff)]">
          {children}
        </main>
      </div>
    </div>
  );
}
