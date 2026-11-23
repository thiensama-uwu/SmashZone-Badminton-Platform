import { useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ChevronDown, Settings, User, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

function resolveHomePathByRole(user) {
  const roles = user?.roles || [];
  if (roles.includes('admin') || roles.includes('staff')) return '/admin/dashboard';
  if (roles.includes('customer')) return '/customer/booking';
  return '/auth/login';
}

function resolveProfilePath(user) {
  const roles = user?.roles || [];
  if (roles.includes('admin') || roles.includes('staff')) return '/admin/profile';
  if (roles.includes('customer')) return '/customer/profile';
  return '/auth/login';
}

export default function UserMenu({ className = '' }) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  const displayName = useMemo(
    () => user?.fullName || user?.full_name || user?.email || 'Người dùng',
    [user]
  );
  const initial = displayName.charAt(0).toUpperCase();
  const profilePath = resolveProfilePath(user);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((v) => !v);
  };

  if (!isAuthenticated) {
    return (
      <Link
        to="/auth/login"
        className={`p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-low transition-colors ${className}`}
        title="Thông tin tài khoản"
      >
        <User size={22} />
      </Link>
    );
  }

  return (
    <div ref={menuRef} className={`relative ${className}`} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full hover:bg-surface-low transition-colors"
        type="button"
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center bg-primary">
            {initial}
          </div>
        )}
        <ChevronDown size={14} className="text-on-surface-variant" />
      </button>

      {open && createPortal(
        <div
          className="w-56 rounded-xl border border-hairline bg-canvas shadow-ambient py-1"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3.5 py-2.5 border-b border-hairline">
            <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
          </div>

          <div className="p-1.5 space-y-0.5">
            <Link
              to={profilePath}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-body hover:text-ink hover:bg-surface-soft transition-colors"
            >
              <User size={16} /> Hồ sơ cá nhân
            </Link>
            <Link
              to={`${profilePath}#change-password`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-body hover:text-ink hover:bg-surface-soft transition-colors"
            >
              <Shield size={16} /> Đổi mật khẩu
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                navigate(resolveHomePathByRole(user));
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-body hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
            >
              <Settings size={16} /> Cài đặt
            </button>
            <button
              onClick={async () => {
                setOpen(false);
                if (location.pathname.startsWith('/customer/') || location.pathname.startsWith('/admin/')) {
                  navigate('/', { replace: true });
                }
                try {
                  await logout();
                } catch {
                  // token already cleared
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-error hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
