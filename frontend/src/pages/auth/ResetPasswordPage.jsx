import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { authApi } from '../../api/auth';

export default function ResetPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length) {
      const newOtp = [...otp];
      paste.split('').forEach((ch, i) => { newOtp[i] = ch; });
      setOtp(newOtp);
      inputRefs.current[Math.min(paste.length, 5)]?.focus();
      e.preventDefault();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!email) {
      setError('Thiếu email. Vui lòng quay lại trang quên mật khẩu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword(email, otp.join(''), password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'OTP không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-surface-lowest rounded-2xl p-8 shadow-ambient text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-fixed/20 flex items-center justify-center mb-6">
            <CheckCircle2 size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface">Đặt lại thành công!</h1>
          <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
            Mật khẩu của bạn đã được thay đổi. Bạn có thể đăng nhập bằng mật khẩu mới.
          </p>
          <Link
            to="/auth/login"
            className="inline-block mt-6 px-8 py-3 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link to="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mb-8">
          <ArrowLeft size={16} /> Quay lại đăng nhập
        </Link>

        {/* Card */}
        <div className="bg-surface-lowest rounded-2xl p-8 shadow-ambient">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-fixed/20 flex items-center justify-center mb-6">
            <ShieldCheck size={28} className="text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-on-surface text-center">Đặt lại mật khẩu</h1>
          <p className="mt-2 text-sm text-on-surface-variant text-center leading-relaxed">
            Nhập mã OTP và tạo mật khẩu mới cho tài khoản của bạn.
          </p>

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
              <AlertCircle size={16} /><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {/* Email (pre-filled from forgot-password flow) */}
            {!location.state?.email && (
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-on-surface mb-1.5">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="Nhập email đã đăng ký"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                />
              </div>
            )}

            {/* OTP */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-3 text-center">Mã OTP</label>
              <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-12 h-12 text-center text-lg font-bold rounded-lg bg-surface-low text-on-surface ghost-border border focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all ${
                      digit ? 'border-primary-container' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-on-surface mb-1.5">Mật khẩu mới</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="reset-confirm" className="block text-sm font-medium text-on-surface mb-1.5">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  id="reset-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Xác nhận mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors">
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || otp.some(d => !d)}
              className="w-full h-11 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </span>
              ) : 'Đặt lại mật khẩu'}
            </button>
          </form>

          {/* Resend */}
          <p className="mt-5 text-center text-sm text-on-surface-variant">
            Không nhận được mã?{' '}
            <button className="font-medium text-primary hover:underline">Gửi lại</button>
          </p>
        </div>
      </div>
    </div>
  );
}
