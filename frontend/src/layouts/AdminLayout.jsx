import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MapPin, CalendarCheck, BarChart3, Settings, LogOut, Users, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import NotificationBell from '../components/shared/NotificationBell';
import UserMenu from '../components/shared/UserMenu';
import ThemeToggle from '../components/shared/ThemeToggle';

const sidebarLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/courts', icon: MapPin, label: 'Quản lý sân' },
  { to: '/admin/bookings', icon: CalendarCheck, label: 'Quản lý đặt sân' },
  { to: '/admin/refunds', icon: RotateCcw, label: 'Hoàn tiền' },
  { to: '/admin/users', icon: Users, label: 'Tài khoản', adminOnly: true },
  { to: '/admin/reports', icon: BarChart3, label: 'Báo cáo', adminOnly: true },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles?.includes('admin');
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const displayName = user?.fullName || user?.full_name || user?.email || (isAdmin ? 'Admin' : 'Staff');
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    try { await logout(); } catch { /* token already cleared */ }
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="admin-light-shell min-h-screen flex flex-col lg:flex-row bg-surface-soft text-ink">
      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-50 bg-canvas/95 backdrop-blur-md border-b border-hairline px-4 py-3 flex items-center justify-between">
        <Link to="/admin/dashboard" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="SmashZone Logo" className="h-7 w-7 object-contain" />
          </div>
          <span className="text-lg font-bold text-primary">SmashZone</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell buttonClassName="text-muted hover:text-ink hover:bg-surface-soft" />
          <UserMenu />
        </div>
      </header>

      {/* Desktop Vertical Sidebar */}
      <aside className="w-full lg:w-64 shrink-0 bg-canvas border-r border-hairline lg:min-h-screen lg:sticky lg:top-0 flex flex-col justify-between p-5 z-40">
        <div>
          {/* Logo */}
          <div className="pb-6 border-b border-hairline">
            <Link to="/admin/dashboard" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                <img src="/logo.png" alt="SmashZone Logo" className="h-8 w-8 object-contain" />
              </div>
              <div>
                <span className="text-xl font-bold text-primary tracking-tight block leading-none">
                  Smash<span className="text-ink">Zone</span>
                </span>
                <span className="text-[11px] text-muted tracking-wide block mt-1">
                  {isAdmin ? 'Quản trị hệ thống' : 'Quản lý nhân viên'}
                </span>
              </div>
            </Link>
          </div>

          {/* User badge */}
          <div className="flex items-center gap-3 p-3 my-4 rounded-xl bg-surface-soft border border-hairline-soft">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayName} className="h-10 w-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-ink truncate">{displayName}</p>
              <span className="inline-block text-[11px] text-primary font-medium">
                {isAdmin ? 'Quản trị viên' : 'Nhân viên'}
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1.5 pt-1">
            <p className="px-3 text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              Menu quản lý
            </p>
            {sidebarLinks.filter(link => !link.adminOnly || isAdmin).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-primary bg-primary-fixed/40 font-semibold'
                      : 'text-body hover:text-ink hover:bg-surface-soft'
                  }`
                }
              >
                <link.icon size={18} className="shrink-0" />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Settings + Logout Footer */}
        <div className="pt-4 border-t border-hairline space-y-1">
          <Link
            to="/admin/profile"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-body hover:text-ink hover:bg-surface-soft transition-colors"
          >
            <Settings size={18} />
            <span>Cài đặt hệ thống</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-error hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-visible">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-hairline bg-canvas sticky top-0 z-30">
          <div>
            <h1 className="text-base font-semibold text-ink">Xin chào, {displayName} 👋</h1>
            <p className="text-xs text-muted capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-3 relative z-[100]">
            <ThemeToggle />
            <NotificationBell buttonClassName="hover:bg-surface-soft text-muted hover:text-ink" />
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 animate-fade-in bg-surface-soft">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


