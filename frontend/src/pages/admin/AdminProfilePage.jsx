import { useState, useEffect, useTransition, useMemo, useRef } from 'react';
import { Camera, Lock, Mail, Phone, User, Calendar as CalendarIcon, Shield, Bell, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { usersApi, notificationsApi } from '../../api/index';
import { authApi } from '../../api/auth';
import { uploadsApi } from '../../api/uploads';
import { useAuth } from '../../contexts/useAuth';

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export default function AdminProfilePage() {
  const { user, updateUser } = useAuth();

  const initialProfile = useMemo(() => ({
    fullName: user?.fullName || user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    gender: user?.gender || '',
    birthDate: user?.birthDate || user?.birth_date || '',
    avatarUrl: user?.avatarUrl || '',
  }), [user]);

  const [profile, setProfile] = useState(initialProfile);
  const avatarInputRef = useRef(null);
  const [notifs, setNotifs] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    notificationsApi.list()
      .then((data) => setNotifs(data.items || []))
      .catch(() => setNotifs([]))
      .finally(() => setLoadingNotifs(false));

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(async (reg) => {
        try {
          const sub = await reg.pushManager.getSubscription();
          if (!sub) return;
          await notificationsApi.subscribe(sub.toJSON());
        } catch { /* push subscription optional */ }
      });
    }
  }, []);

  const handleChange = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });

  const handleSave = () => {
    setSaveMsg(''); setSaveError('');
    startTransition(async () => {
      try {
        const updated = await usersApi.updateProfile({
          fullName: profile.fullName,
          phone: profile.phone,
          gender: profile.gender,
          birthDate: profile.birthDate || undefined,
          avatarUrl: profile.avatarUrl || undefined,
        });
        updateUser(updated);
        setSaveMsg('Lưu thành công!');
        setTimeout(() => setSaveMsg(''), 3000);
      } catch (err) {
        setSaveError(err.message || 'Lưu thất bại.');
      }
    });
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSaveMsg('');
    setSaveError('');
    setIsAvatarUploading(true);
    try {
      const uploaded = await uploadsApi.uploadImage(file);
      const updated = await usersApi.updateProfile({ avatarUrl: uploaded.url });
      if (!updated.avatarUrl) {
        throw new Error('Server chua luu duoc anh dai dien.');
      }
      setProfile((current) => ({ ...current, avatarUrl: updated.avatarUrl }));
      updateUser(updated);
      setSaveMsg('Cap nhat anh dai dien thanh cong!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveError(err.message || 'Cap nhat anh dai dien that bai.');
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifs(notifs.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    } catch { /* ignore */ }
  };

  const unreadCount = notifs.filter((n) => !n.readAt).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-surface-lowest rounded-2xl p-6 shadow-ambient">
        <h2 className="text-lg font-bold text-on-surface mb-5">Hồ sơ cá nhân</h2>

        {/* Avatar */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.fullName || 'Avatar'} className="h-full w-full rounded-full object-cover" />
              ) : (
                profile.fullName?.charAt(0)?.toUpperCase() || 'A'
              )}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isAvatarUploading}
              aria-label="Cap nhat anh dai dien"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface-lowest border border-outline-variant/30 flex items-center justify-center shadow-sm hover:bg-surface-low transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Camera size={14} className="text-on-surface-variant" />
            </button>
          </div>
          <div>
            <p className="font-semibold text-on-surface">{profile.fullName || 'Admin/Staff'}</p>
            <p className="text-sm text-on-surface-variant">{profile.email}</p>
          </div>
        </div>

        {/* Alerts */}
        {saveMsg && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            <CheckCircle size={16} /><span>{saveMsg}</span>
          </div>
        )}
        {saveError && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
            <AlertCircle size={16} /><span>{saveError}</span>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Họ và tên</label>
            <div className="relative">
              <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
              <input name="fullName" type="text" value={profile.fullName} onChange={handleChange}
                className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input type="email" value={profile.email} readOnly
                  className="w-full h-11 pl-11 pr-10 rounded-lg bg-surface-high text-on-surface-variant text-sm cursor-not-allowed ghost-border border" />
                <Lock size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">Số điện thoại</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input name="phone" type="tel" value={profile.phone} onChange={handleChange}
                  className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border transition-all" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">Giới tính</label>
              <select name="gender" value={profile.gender} onChange={handleChange}
                className="w-full h-11 px-4 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border appearance-none">
                <option value="">-- Chọn --</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">Ngày sinh</label>
              <div className="relative">
                <CalendarIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input name="birthDate" type="date" value={profile.birthDate?.slice(0, 10) || ''} onChange={handleChange}
                  className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border transition-all" />
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={isPending}
            className="px-6 py-2.5 rounded-xl font-semibold text-white bg-primary hover:bg-primary-active transition-colors disabled:opacity-60 disabled:cursor-not-allowed btn-press">
            {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-surface-lowest rounded-2xl p-6 shadow-ambient">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Bell size={18} />
            Thông báo
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-error text-white px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h2>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs font-medium text-primary hover:underline">
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        <div className="space-y-1">
          {loadingNotifs ? (
            [1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-surface-low animate-pulse" />)
          ) : notifs.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-6">Chưa có thông báo nào.</p>
          ) : notifs.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${!n.readAt ? 'bg-primary-fixed/30' : 'hover:bg-surface-low'}`}>
              <div className="w-9 h-9 rounded-lg bg-surface-low flex items-center justify-center shrink-0 text-primary">
                <Bell size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.readAt ? 'font-semibold text-on-surface' : 'font-medium text-on-surface-variant'}`}>
                  {n.eventType?.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">{n.message}</p>
                <p className="text-[11px] text-outline mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.readAt && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0 animate-pulse" />}
            </div>
          ))}
        </div>
      </div>

      {/* Security — Change Password */}
      <ChangePasswordSection />
    </div>
  );
}

function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (window.location.hash === '#change-password') {
      setOpen(true);
      const section = document.getElementById('change-password');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  const handleChange = async () => {
    setMsg(''); setErr('');
    if (newPw !== confirmPw) { setErr('Mật khẩu xác nhận không khớp.'); return; }
    if (newPw.length < 8) { setErr('Mật khẩu mới tối thiểu 8 ký tự.'); return; }
    setLoading(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      setMsg('Đổi mật khẩu thành công!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setMsg(''); setOpen(false); }, 2000);
    } catch (e) {
      setErr(e.message || 'Đổi mật khẩu thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="change-password" className="bg-surface-lowest rounded-2xl p-6 shadow-ambient">
      <h2 className="text-lg font-bold text-on-surface mb-4">Bảo mật</h2>

      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-on-surface border border-outline-variant/30 hover:bg-surface-low transition-colors btn-press">
          <Shield size={16} /> Đổi mật khẩu
        </button>
      ) : (
        <div className="space-y-4 max-w-md">
          {msg && <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm"><CheckCircle size={16} />{msg}</div>}
          {err && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm"><AlertCircle size={16} />{err}</div>}

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Mật khẩu hiện tại</label>
            <p className="mb-1.5 text-xs text-on-surface-variant">Để trống nếu tài khoản Google chưa đặt mật khẩu.</p>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
              <input type={showCur ? 'text' : 'password'} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border transition-all" />
              <button type="button" onClick={() => setShowCur(!showCur)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant">
                {showCur ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Mật khẩu mới</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
              <input type={showNew ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                className="w-full h-11 pl-11 pr-11 rounded-lg bg-surface-low text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border transition-all" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant">
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Xác nhận mật khẩu mới</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full h-11 pl-11 pr-4 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border transition-all" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleChange} disabled={loading || !newPw}
              className="px-6 py-2.5 rounded-xl font-semibold text-white bg-primary hover:bg-primary-active transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Đang lưu...' : 'Xác nhận'}
            </button>
            <button onClick={() => { setOpen(false); setErr(''); setMsg(''); }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-low transition-colors">
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
