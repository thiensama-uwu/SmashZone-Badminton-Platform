import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { CalendarDays, History, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import NotificationBell from '../components/shared/NotificationBell';
import UserMenu from '../components/shared/UserMenu';
import ThemeToggle from '../components/shared/ThemeToggle';

const sidebarLinks = [
  { to: '/customer/booking', icon: CalendarDays, label: 'Đặt sân' },
  { to: '/customer/history', icon: History, label: 'Lịch sử đặt sân' },
  { to: '/customer/profile', icon: UserCircle, label: 'Hồ sơ cá nhân' },
];

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logout(); } catch { /* token already cleared */ }
    navigate('/auth/login', { replace: true });
  };

  const displayName = user?.fullName || user?.full_name || 'Người dùng';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-surface-soft flex flex-col md:flex-row text-ink">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-50 bg-canvas/95 backdrop-blur-md border-b border-hairline px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="SmashZone Logo" className="h-7 w-7 object-contain" />
          </div>
          <span className="text-lg font-bold text-primary">
            Smash<span className="text-ink">Zone</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell buttonClassName="text-muted hover:text-ink hover:bg-surface-soft" />
          <UserMenu />
        </div>
      </header>

      {/* Desktop Vertical Sidebar */}
      <aside className="w-full md:w-64 lg:w-72 shrink-0 bg-canvas border-r border-hairline md:min-h-screen md:sticky md:top-0 flex flex-col justify-between p-5 z-40">
        <div>
          {/* Logo / Brand */}
          <div className="hidden md:block pb-6 border-b border-hairline">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                <img src="/logo.png" alt="SmashZone Logo" className="h-8 w-8 object-contain" />
              </div>
              <div>
                <span className="text-xl font-bold text-primary tracking-tight block leading-none">
                  Smash<span className="text-ink">Zone</span>
                </span>
                <span className="text-[11px] text-muted tracking-wide block mt-1">Cổng khách hàng</span>
              </div>
            </Link>
          </div>

          {/* User Card */}
          <div className="flex items-center gap-3 p-3.5 my-4 rounded-xl bg-surface-soft border border-hairline-soft">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayName} className="h-11 w-11 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-11 w-11 rounded-full bg-primary flex items-center justify-center text-white text-base font-bold shrink-0">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-ink truncate">{displayName}</p>
              <span className="inline-block text-[11px] text-primary font-medium mt-0.5">
                Thành viên
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1.5 pt-2">
            <p className="px-3 text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              Khách hàng
            </p>
            {sidebarLinks.map((link) => (
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

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-hairline space-y-2">
          <div className="hidden md:flex items-center justify-between px-2 py-1">
            <span className="text-xs text-muted">Giao diện</span>
            <div className="flex items-center gap-2">
              <NotificationBell buttonClassName="text-muted hover:text-ink hover:bg-surface-soft" />
              <ThemeToggle />
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-error hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 animate-fade-in bg-canvas md:bg-surface-soft">
        <Outlet />
      </main>
    </div>
  );
}


