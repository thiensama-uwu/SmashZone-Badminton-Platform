import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Home, Map, Info, PhoneCall, FileText, CalendarDays, Sparkles, User } from 'lucide-react';
import UserMenu from './UserMenu';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../../contexts/useAuth';

function resolveMobileAccountPath(user) {
  const roles = user?.roles || [];
  if (roles.includes('admin') || roles.includes('staff')) return '/admin/profile';
  if (roles.includes('customer')) return '/customer/profile';
  return '/auth/login';
}

const navLinks = [
  { to: '/', label: 'Trang chủ', icon: Home, isNew: false },
  { to: '/courts', label: 'Danh sách sân', icon: Map, isNew: false },
  { to: '/about', label: 'Giới thiệu', icon: Info, isNew: false },
  { to: '/contact', label: 'Liên hệ', icon: PhoneCall, isNew: false },
  { to: '/policies', label: 'Chính sách', icon: FileText, isNew: false },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleBookNow = () => {
    if (isAuthenticated) {
      navigate('/customer/booking');
    } else {
      navigate('/auth/login', { state: { redirectTo: '/customer/booking' } });
    }
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-50 bg-canvas/95 backdrop-blur-md border-b border-hairline px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="SmashZone Logo" className="h-7 w-7 object-contain" />
          </div>
          <span className="text-lg font-bold text-primary tracking-tight">
            Smash<span className="text-ink">Zone</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
          <button
            id="mobile-menu-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-ink hover:bg-surface-soft transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop & Drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-72 bg-canvas border-r border-hairline p-5 flex flex-col justify-between shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-hairline">
                <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center overflow-hidden">
                    <img src="/logo.png" alt="SmashZone Logo" className="h-7 w-7 object-contain" />
                  </div>
                  <span className="text-lg font-bold text-primary">
                    Smash<span className="text-ink">Zone</span>
                  </span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-soft"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mobile Links */}
              <nav className="mt-5 space-y-1.5">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === '/'}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'text-primary bg-primary-fixed/40 font-semibold'
                            : 'text-body hover:text-ink hover:bg-surface-soft'
                        }`
                      }
                    >
                      <Icon size={18} className="shrink-0" />
                      <span>{link.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-hairline space-y-3">
              <button
                onClick={() => {
                  handleBookNow();
                  setMobileOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-active transition-colors shadow-sm"
              >
                <CalendarDays size={18} />
                Đặt sân ngay
              </button>

              <Link
                to={resolveMobileAccountPath(user)}
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-ink bg-surface-soft hover:bg-surface-strong transition-colors"
              >
                <User size={16} />
                {isAuthenticated ? 'Hồ sơ cá nhân' : 'Đăng nhập / Tài khoản'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Vertical Sidebar (Thanh taskbar dọc) */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 h-screen sticky top-0 bg-canvas border-r border-hairline p-5 z-40 select-none">
        {/* Brand / Logo */}
        <div className="pb-6 border-b border-hairline">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
              <img src="/logo.png" alt="SmashZone Logo" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <span className="text-xl font-bold text-primary tracking-tight block leading-none">
                Smash<span className="text-ink">Zone</span>
              </span>
              <span className="text-[11px] text-muted tracking-wide block mt-1">Sân cầu lông toàn quốc</span>
            </div>
          </Link>
        </div>

        {/* Vertical Nav Links */}
        <div className="flex-1 py-6 overflow-y-auto space-y-1.5">
          <p className="px-3 text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
            Điều hướng
          </p>
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-primary bg-primary-fixed/40 font-semibold'
                      : 'text-body hover:text-ink hover:bg-surface-soft'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className="shrink-0" />
                  <span>{link.label}</span>
                </div>
                {link.isNew && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-white">
                    Mới
                  </span>
                )}
              </NavLink>
            );
          })}

          <div className="pt-6">
            <div className="p-4 rounded-xl bg-surface-soft border border-hairline-soft">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
                <Sparkles size={14} /> Trải nghiệm tốt nhất
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Đặt sân dễ dàng với lịch trống real-time và chính sách hoàn hủy linh hoạt.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Actions & User Footer */}
        <div className="pt-4 border-t border-hairline space-y-3">
          {/* Booking CTA Button (8px radius, height 48px per DESIGN.md) */}
          <button
            onClick={handleBookNow}
            className="w-full h-12 flex items-center justify-center gap-2 px-4 rounded-lg font-medium text-sm text-white bg-primary hover:bg-primary-active transition-colors shadow-ambient btn-press cursor-pointer"
          >
            <CalendarDays size={18} />
            <span>Đặt sân ngay</span>
          </button>

          {/* User profile / tools */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2">
              <UserMenu />
              <div className="text-left">
                <p className="text-xs font-semibold text-ink leading-tight">
                  {isAuthenticated ? (user?.fullName || user?.full_name || 'Tài khoản') : 'Khách vãng lai'}
                </p>
                <p className="text-[11px] text-muted leading-tight">
                  {isAuthenticated ? 'Đã đăng nhập' : 'Chưa đăng nhập'}
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}


