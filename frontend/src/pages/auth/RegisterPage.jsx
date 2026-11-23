import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { authApi } from '../../api/auth';
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

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!agreed) return;
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    // Validate that at least email or phone is provided
    if (!formData.email && !formData.phone) {
      setError('Vui lòng nhập ít nhất email hoặc số điện thoại.');
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        await authApi.register(formData.email, formData.phone, formData.password, formData.name);
        setSuccess(true);
        setTimeout(() => navigate('/auth/login'), 2000);
      } catch (err) {
        setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
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
      await authApi.googleAuth(idToken);
      toast.success('Đăng ký/đăng nhập Google thành công!');
      navigate('/customer/booking', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Đăng ký với Google thất bại.');
    }
  }, [navigate, toast]);

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
          text: 'signup_with',
          width: 380,
          locale: 'vi',
        });
        setGoogleReady(true);
      })
      .catch((err) => {
        toast.error(err.message || 'Không thể khởi tạo đăng ký Google.');
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId, handleGoogleCredential, toast]);

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-16 right-16 w-72 h-72 rounded-full border-2 border-white/30" />
          <div className="absolute bottom-24 left-8 w-80 h-80 rounded-full border-2 border-white/20" />
          <div className="absolute top-1/3 left-1/3 w-56 h-56 rounded-full border-2 border-white/10" />
        </div>
        <div className="relative flex flex-col items-center justify-center w-full px-12">
          <div className="h-40 w-40 md:h-56 md:w-56 rounded-3xl bg-gray-100 border border-gray-300 shadow-2xl flex items-center justify-center mb-8 overflow-hidden p-3">
            <img src="/logo.png" alt="SmashZone Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white text-center">SmashZone</h1>
          <p className="mt-4 text-lg text-white/80 text-center max-w-sm leading-relaxed">
            Tham gia cộng đồng cầu lông lớn nhất. Tìm sân, đặt lịch, kết nối người chơi.
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

          <h2 className="text-2xl font-bold text-on-surface">Tạo tài khoản</h2>
          <p className="mt-1 text-on-surface-variant">Đăng ký miễn phí và bắt đầu đặt sân.</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
              <CheckCircle size={16} className="shrink-0" />
              <span>Đăng ký thành công! Đang chuyển đến đăng nhập...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-on-surface mb-1.5">Họ và tên</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  id="reg-name" name="name" type="text" placeholder="Họ và tên" required
                  value={formData.name} onChange={handleChange}
                  className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                />
              </div>
            </div>

            {/* Email & Phone row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-on-surface mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    id="reg-email" name="email" type="email" placeholder="Email" required
                    value={formData.email} onChange={handleChange}
                    className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-on-surface mb-1.5">Số điện thoại</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    id="reg-phone" name="phone" type="tel" placeholder="Số điện thoại"
                    value={formData.phone} onChange={handleChange}
                    className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-on-surface mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  id="reg-password" name="password" type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu (tối thiểu 8 ký tự)" required
                  value={formData.password} onChange={handleChange}
                  className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-on-surface mb-1.5">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  id="reg-confirm" name="confirmPassword" type={showConfirm ? 'text' : 'password'}
                  placeholder="Xác nhận mật khẩu" required
                  value={formData.confirmPassword} onChange={handleChange}
                  className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors">
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Agreement */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary-container accent-primary"
              />
              <span className="text-sm text-on-surface-variant leading-snug">
                Tôi đồng ý với{' '}
                <Link to="/terms" className="text-primary font-medium hover:underline">Điều khoản dịch vụ</Link>
                {' '}và{' '}
                <Link to="/privacy" className="text-primary font-medium hover:underline">Chính sách bảo mật</Link>
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || !agreed || success}
              className="w-full h-11 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang tạo tài khoản...
                </span>
              ) : 'Đăng ký'}
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
                  Thiếu cấu hình `VITE_GOOGLE_CLIENT_ID` để bật đăng ký Google.
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
          <p className="mt-6 text-center text-sm text-on-surface-variant">
            Đã có tài khoản?{' '}
            <Link to="/auth/login" className="font-semibold text-primary hover:underline">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


