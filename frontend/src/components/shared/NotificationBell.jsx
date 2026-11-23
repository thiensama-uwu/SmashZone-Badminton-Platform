import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../../api';
import { useAuth } from '../../contexts/useAuth';

function timeAgo(dateStr) {
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function formatEventLabel(eventType) {
  const map = {
    'booking.confirmed': 'Đặt sân thành công',
    'booking.cancelled': 'Đặt sân đã bị hủy',
    'booking.rescheduled': 'Đặt sân đã được đổi lịch',
    'booking.refunded': 'Hoàn tiền booking thành công',
    'payment.failed': 'Thanh toán thất bại',
  };
  return map[eventType] || 'Thông báo mới';
}

function getRelatedBookingId(item) {
  return item?.payload?.bookingId || item?.aggregateId || null;
}

export default function NotificationBell({ buttonClassName = '', panelClassName = '' }) {
  const { user } = useAuth();
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications],
  );

  const loadNotifications = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await notificationsApi.list();
      setNotifications(data.items || []);
    } catch {
      setNotifications([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target) && !dropdownRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadNotifications(true);
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  const handleToggle = async (e) => {
    e.stopPropagation();
    const next = !open;
    if (next && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(next);
    if (next) {
      await loadNotifications();
    }
  };

  const markRead = async (notificationId) => {
    const target = notifications.find((item) => item.id === notificationId);
    if (!target || target.readAt) return;

    try {
      await notificationsApi.markRead(notificationId);
      setNotifications((prev) => prev.map((item) => (
        item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item
      )));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const navigateToRelatedBooking = (item) => {
    const bookingId = getRelatedBookingId(item);
    console.log('Navigate to booking:', { bookingId, item, payload: item?.payload, aggregateId: item?.aggregateId });
    
    const isStaff = user?.roles?.includes('admin') || user?.roles?.includes('staff');
    console.log('User roles:', user?.roles, 'isStaff:', isStaff);
    
    try {
      if (!bookingId) {
        console.warn('No bookingId found in notification:', item);
        // Fallback: try to navigate to the bookings page without filter
        const path = isStaff ? '/admin/bookings' : '/customer/history';
        console.log('Fallback navigating to:', path);
        window.location.href = path;
        setOpen(false);
        return;
      }

      const path = isStaff ? '/admin/bookings' : '/customer/history';
      const url = `${path}?bookingId=${encodeURIComponent(bookingId)}`;
      console.log('Navigating to:', url);
      window.location.href = url;
      setOpen(false);
    } catch (error) {
      console.error('Error during navigation:', error);
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) {
      alert('Không có thông báo chưa đọc');
      return;
    }
    try {
      console.log('Marking all notifications as read');
      alert('Đang đánh dấu tất cả đã đọc...');
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      await loadNotifications(true);
      alert('Đã đánh dấu tất cả đã đọc thành công');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      alert('Lỗi khi đánh dấu đã đọc: ' + error.message);
    }
  };

  return (
    <div ref={wrapperRef} className="relative" style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`relative p-2 rounded-lg transition-colors ${buttonClassName}`.trim()}
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error" />}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className={`w-[360px] max-w-[90vw] rounded-xl border border-hairline bg-canvas shadow-ambient ${panelClassName}`.trim()}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            zIndex: 9999,
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
            <p className="text-sm font-semibold text-ink">Thông báo</p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
            >
              Đánh dấu tất cả đã đọc
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2" onClick={(e) => e.stopPropagation()}>
            {loading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-surface-soft animate-pulse" />)}
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">Chưa có thông báo nào.</p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Notification div clicked:', item);
                    markRead(item.id);
                    navigateToRelatedBooking(item);
                  }}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer ${!item.readAt ? 'bg-primary-fixed/40 hover:bg-primary-fixed/60' : 'hover:bg-surface-soft'
                    }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-soft flex items-center justify-center shrink-0 text-primary">
                    <Bell size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!item.readAt ? 'font-semibold text-ink' : 'font-medium text-body'}`}>
                      {formatEventLabel(item.eventType)}
                    </p>
                    <p className="text-xs text-muted truncate mt-0.5">{item.message}</p>
                    <p className="text-[11px] text-muted-soft mt-1">{timeAgo(item.createdAt)}</p>
                  </div>
                  {!item.readAt && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
