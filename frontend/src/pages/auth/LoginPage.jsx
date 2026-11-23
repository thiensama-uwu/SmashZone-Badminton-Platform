import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Phone } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

const GOOGLE_SCRIPT_ID = 'google-identity-services';

function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      if (window.google?.accounts?.id) resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Google Identity script'));
    document.head.appendChild(script);
  });
}


function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState('email');
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleModeSwitch = (mode) => {
    setLoginMode(mode);
    setFormData({ identifier: '', password: '' });
    setError('');
  };

  const resolveRedirect = useCallback((data) => {
    const fromState = location.state?.from;
    const redirectTo = location.state?.redirectTo;
    const payload = parseJwt(data?.accessToken || '');
    const roles = data?.user?.roles || payload?.roles || [];

    // Admin/staff always redirect to dashboard
    if (roles.some((role) => role === 'admin' || role === 'staff')) {
      return '/admin/dashboard';
    }

    // If there's a specific redirectTo path (from "Đặt sân ngay" button), use it
    if (redirectTo) {
      return redirectTo;
    }

    // If there's a from path for customer, use it (but exclude auth pages)
    let fromPath = null;
    if (fromState) {
      fromPath = typeof fromState === 'string' ? fromState : fromState.pathname || '/';
    }

    // If user came from register page (first-time login), redirect to home
    if (fromPath && fromPath.includes('/auth/register')) {
      return '/';
    }

    // Don't redirect back to auth pages after successful login
    if (fromPath && (fromPath.includes('/auth/login') || fromPath.includes('/auth/forgot-password'))) {
      return '/';
    }

    // If there's a from path for customer, use it
    if (fromPath) {
      return fromPath;
    }

    // Default redirect for customer (no from path = first-time or direct access)
    return '/';
  }, [location.state]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        const data = await login(formData.identifier, formData.password);
        const redirectTo = resolveRedirect(data);
        // Preserve original state when redirecting
        const originalState = location.state?.originalState || {};
        navigate(redirectTo, { replace: true, state: originalState });
      } catch (err) {
        if (err?.code === 'PASSWORD_NOT_SET') {
          setError('Tai khoan nay duoc tao bang Google. Vui long dat mat khau bang OTP email hoac tiep tuc dang nhap Google.');
          return;
        }
        if (err?.status === 401 || err?.code === 'INVALID_CREDENTIALS') {
          setError('Nhập sai tài khoản, vui lòng thử lại.');
          return;
        }
        setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    });
  };

  const handleGoogleCredential = useCallback(async (response) => {
    try {
      const idToken = response?.credential;
      if (!idToken) {
        toast.error('Không lấy được thông tin đăng nhập Google.');
        return;
      }
      const data = await googleLogin(idToken);
      toast.success('Đăng nhập Google thành công!');

      const redirectTo = resolveRedirect(data);
      // Preserve original state when redirecting
      const originalState = location.state?.originalState || {};
      navigate(redirectTo, { replace: true, state: originalState });
    } catch (err) {
      toast.error(err.message || 'Đăng nhập với Google thất bại.');
    }
  }, [toast, googleLogin, navigate, location.state, resolveRedirect]);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;
    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
          ux_mode: 'popup',
        });
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 380,
          locale: 'vi',
        });
        setGoogleReady(true);
      })
      .catch((err) => {
        console.warn('Google Sign-In init failed:', err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId, handleGoogleCredential]);

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full border-2 border-white/30" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full border-2 border-white/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border-2 border-white/10" />
        </div>
        <div className="relative flex flex-col items-center justify-center w-full px-12">
          <div className="h-40 w-40 md:h-56 md:w-56 rounded-3xl bg-gray-100 border border-gray-300 shadow-2xl flex items-center justify-center mb-8 overflow-hidden p-3">
            <img src="/logo.png" alt="SmashZone Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white text-center">SmashZone</h1>
          <p className="mt-4 text-lg text-white/80 text-center max-w-sm leading-relaxed">
            Đặt sân cầu lông dễ dàng, nhanh chóng. Tìm sân yêu thích chỉ trong vài bước.
          </p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 border border-gray-300 flex items-center justify-center overflow-hidden p-1">
              <img src="/logo.png" alt="SmashZone Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-bold text-primary">Smash<span className="text-on-surface">Zone</span></span>
          </div>

          <h2 className="text-2xl font-bold text-on-surface">Đăng nhập</h2>
          <p className="mt-1 text-on-surface-variant">Chào mừng bạn trở lại!</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-outline-variant/40 bg-surface-low">
              <button
                type="button"
                onClick={() => handleModeSwitch('email')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                  loginMode === 'email'
                    ? 'bg-primary text-white'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Mail size={15} />
                Email
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('phone')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                  loginMode === 'phone'
                    ? 'bg-primary text-white'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Phone size={15} />
                Số điện thoại
              </button>
            </div>

            {/* Identifier input */}
            <div>
              <label htmlFor="login-identifier" className="block text-sm font-medium text-on-surface mb-1.5">
                {loginMode === 'email' ? 'Email' : 'Số điện thoại'}
              </label>
              <div className="relative">
                {loginMode === 'email'
                  ? <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                  : <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                }
                <input
                  id="login-identifier"
                  name="identifier"
                  type={loginMode === 'email' ? 'email' : 'tel'}
                  placeholder={loginMode === 'email' ? 'Email của bạn' : 'Số điện thoại của bạn'}
                  value={formData.identifier}
                  onChange={handleChange}
                  required
                  disabled={isPending}
                  className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-on-surface mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isPending}
                  className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div className="text-right">
              <Link to="/auth/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Quên mật khẩu?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-11 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang đăng nhập...
                </span>
              ) : 'Đăng nhập'}
            </button>

            {/* Divider */}
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant/30" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-background text-xs text-outline">hoặc</span>
              </div>
            </div>

            {/* Google */}
            <div className="w-full min-h-[44px] flex items-center justify-center">
              {!googleClientId ? (
                <p className="text-xs text-on-surface-variant text-center">
                  Thiếu cấu hình `VITE_GOOGLE_CLIENT_ID` để bật đăng nhập Google.
                </p>
              ) : (
                <div ref={googleButtonRef} className="w-full flex items-center justify-center" />
              )}
            </div>
            {googleClientId && !googleReady && (
              <p className="text-xs text-on-surface-variant text-center">Đang tải Google Sign-In...</p>
            )}
          </form>

          {/* Bottom link */}
          <p className="mt-8 text-center text-sm text-on-surface-variant">
            Chưa có tài khoản?{' '}
            <Link to="/auth/register" className="font-semibold text-primary hover:underline">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


