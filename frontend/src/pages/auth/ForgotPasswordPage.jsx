import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';
import { authApi } from '../../api/auth';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

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
            <KeyRound size={28} className="text-primary" />
          </div>

          {!sent ? (
            <>
              <h1 className="text-2xl font-bold text-on-surface text-center">Quên mật khẩu?</h1>
              <p className="mt-2 text-sm text-on-surface-variant text-center leading-relaxed">
                Nhập email đã đăng ký, chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.
              </p>

              {error && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
                  <AlertCircle size={16} /><span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-on-surface mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                    <input
                      id="forgot-email"
                      type="email"
                      placeholder="Email của bạn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:bg-surface-lowest ghost-border border transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang gửi...
                    </span>
                  ) : 'Gửi mã OTP'}
                </button>
              </form>
            </>
          ) : (
            /* Success State */
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary-fixed/20 flex items-center justify-center mb-4">
                <Mail size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold text-on-surface">Kiểm tra email!</h2>
              <p className="mt-2 text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Chúng tôi đã gửi mã OTP đến <span className="font-semibold text-on-surface">{email}</span>. Vui lòng kiểm tra hộp thư.
              </p>
              <button
                onClick={() => navigate('/auth/reset-password', { state: { email } })}
                className="inline-block mt-6 px-6 py-2.5 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity"
              >
                Nhập mã OTP
              </button>
              <p className="mt-4 text-sm text-on-surface-variant">
                Không nhận được email?{' '}
                <button onClick={() => setSent(false)} className="font-medium text-primary hover:underline">
                  Gửi lại
                </button>
              </p>
            </div>
          )}

          {/* Bottom */}
          {!sent && (
            <p className="mt-6 text-center text-sm text-on-surface-variant">
              Nhớ mật khẩu rồi?{' '}
              <Link to="/auth/login" className="font-semibold text-primary hover:underline">
                Đăng nhập
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
