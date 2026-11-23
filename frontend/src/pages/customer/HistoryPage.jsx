import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Search, Filter, Eye, Calendar, ChevronLeft, ChevronRight, X, AlertCircle, CalendarSync } from 'lucide-react';
import { bookingsApi } from '../../api/bookings';
import { courtsApi } from '../../api/courts';
import { useApi } from '../../hooks/useApi';
import AsyncState from '../../components/AsyncState';
import { useToast } from '../../contexts/useToast';

const statusConfig = {
  PENDING_HOLD:    { label: 'Chờ xác nhận', classes: 'bg-amber-50 text-amber-600' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', classes: 'bg-blue-50 text-blue-600' },
  CONFIRMED:       { label: 'Đã xác nhận', classes: 'bg-primary-fixed/20 text-primary' },
  CHECKED_IN:      { label: 'Đã check-in', classes: 'bg-green-50 text-green-600' },
  CANCELLED:       { label: 'Đã hủy', classes: 'bg-red-50 text-error' },
  REFUND_PENDING:  { label: 'Chờ hoàn tiền', classes: 'bg-orange-50 text-orange-600' },
  REFUNDED:        { label: 'Đã hoàn tiền', classes: 'bg-surface-high text-on-surface-variant' },
  EXPIRED:         { label: 'Hết hạn', classes: 'bg-surface-high text-outline' },
};

const PAGE_SIZE = 8;
const FILTER_OPTIONS = ['Tất cả', 'CONFIRMED', 'PENDING_PAYMENT', 'CANCELLED', 'CHECKED_IN'];
const HISTORY_UI_STATE_KEY = 'customer_history_ui_state';

function loadUiState() {
  try {
    const raw = localStorage.getItem(HISTORY_UI_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveUiState(next) {
  try {
    localStorage.setItem(HISTORY_UI_STATE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function formatPrice(n) { return n?.toLocaleString('vi-VN') + 'đ'; }

function formatBookingDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatBookingSlots(reservations, startTime, endTime) {
  const slots = reservations?.length ? reservations : [{ startTime, endTime }];
  
  if (slots.length === 0) return '—';
  if (slots.length === 1) return `${slots[0].startTime} - ${slots[0].endTime}`;
  
  // Sort slots by start time
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  // Check if slots are consecutive and merge them
  const merged = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    // Check if current.endTime equals next.startTime (consecutive)
    if (current.endTime === next.startTime) {
      current.endTime = next.endTime;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  
  // Format: if all merged into one, show single range; otherwise show each on separate line
  if (merged.length === 1) {
    return `${merged[0].startTime} - ${merged[0].endTime}`;
  }
  
  return merged.map(s => `${s.startTime} - ${s.endTime}`).join('\n');
}

export default function HistoryPage() {
  const toast = useToast();
  const location = useLocation();
  const persisted = loadUiState();
  const [search, setSearch] = useState(persisted?.search || '');
  const [filter, setFilter] = useState(persisted?.filter || 'Tất cả');
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(persisted?.page || 1);

  const fetcher = useCallback(() => bookingsApi.history(), []);
  const { data, loading, error, refresh } = useApi('bookings:history', fetcher, {
    ttlMs: 30_000,
    onError: (err) => toast.error(err.message || 'Không thể tải lịch sử đặt sân.'),
  });

  const bookings = data?.items || (Array.isArray(data) ? data : []);
  const queryBookingId = new URLSearchParams(location.search).get('bookingId') || '';

  // Load courts for name resolution (YC19)
  const courtsFetcher = useCallback(() => courtsApi.list({ includeInactive: true }), []);
  const { data: courtsData } = useApi('history:courts:all', courtsFetcher, { ttlMs: 120_000 });
  const courtsList = courtsData?.items || (Array.isArray(courtsData) ? courtsData : []);
  const getCourtName = (courtId) => {
    const court = courtsList.find(c => c.id === courtId);
    return court?.name || courtId;
  };

  // YC19: Exclude cancelled from total count
  const activeBookings = bookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'EXPIRED');
  const stats = {
    total: activeBookings.length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    pending: bookings.filter(b => b.status === 'PENDING_PAYMENT').length,
  };

  const filtered = bookings.filter((b) => {
    if (queryBookingId) {
      return b.id === queryBookingId;
    }
    const matchSearch = b.bookingCode?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'Tất cả' || b.status === filter;
    return matchSearch && matchFilter;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const persistUi = (next) => {
    saveUiState({
      search: next.search ?? search,
      filter: next.filter ?? filter,
      page: next.page ?? page,
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-on-surface">Lịch sử đặt sân</h1>
        <button onClick={refresh} className="text-xs font-medium text-primary hover:underline">Làm mới</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Tổng đặt sân (chưa hủy)', value: stats.total, color: 'text-on-surface' },
          { label: 'Đã xác nhận', value: stats.confirmed, color: 'text-primary' },
          { label: 'Chờ thanh toán', value: stats.pending, color: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="bg-surface-lowest rounded-xl p-4 shadow-sm">
            <p className="text-xs text-on-surface-variant">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input type="text" placeholder="Tìm theo mã booking..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); persistUi({ search: e.target.value, page: 1 }); }}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-low text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border transition-all" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-outline" />
          {FILTER_OPTIONS.map((f) => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); persistUi({ filter: f, page: 1 }); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-surface-high text-on-surface-variant hover:bg-surface-container'}`}>
              {f === 'Tất cả' ? 'Tất cả' : (statusConfig[f]?.label || f)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && filtered.length === 0}
        skeletonType="card"
        skeletonRows={4}
        emptyText={search || filter !== 'Tất cả' ? 'Không tìm thấy booking nào khớp.' : 'Bạn chưa có đặt sân nào.'}
        retryFn={refresh}
      >
        <div className="space-y-3">
          {paginated.map((b) => {
            const status = statusConfig[b.status] || { label: b.status, classes: 'bg-surface-high text-on-surface-variant' };
            return (
                <div key={b.id} className="bg-surface-lowest rounded-xl shadow-sm overflow-hidden transition-lift">
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface font-mono">{b.bookingCode}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {formatBookingDate(b.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.classes}`}>{status.label}</span>
                    <span className="text-sm font-bold text-on-surface hidden sm:block">{formatPrice(b.totalAmount)}</span>
                    <button onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Eye size={14} /> Chi tiết
                    </button>
                  </div>
                </div>
                {(expandedId === b.id || (queryBookingId && queryBookingId === b.id)) && (
                  <div className="px-4 pb-4">
                    <div className="bg-surface-low rounded-lg p-3 text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-on-surface-variant">Mã booking</span><span className="font-mono">{b.bookingCode}</span></div>
                      {/* YC19: Show full court name instead of ID */}
                      <div className="flex justify-between"><span className="text-on-surface-variant">Sân</span><span>{getCourtName(b.courtId)}</span></div>
                      <div className="flex justify-between"><span className="text-on-surface-variant">Ngày</span><span>{b.date}</span></div>
                      <div className="flex justify-between items-start"><span className="text-on-surface-variant">Giờ</span><span className="text-right whitespace-pre-line">{formatBookingSlots(b.reservations, b.startTime, b.endTime)}</span></div>
                      <div className="flex justify-between pt-2 border-t border-outline-variant/20">
                        <span className="font-semibold">Tổng</span>
                        <span className="font-bold text-primary">{formatPrice(b.totalAmount)}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <BookingActions booking={b} onDone={refresh} courtsList={courtsList} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button disabled={page === 1} onClick={() => { const next = page - 1; setPage(next); persistUi({ page: next }); }} className="p-2 rounded-lg hover:bg-surface-low transition-colors disabled:opacity-40">
              <ChevronLeft size={16} className="text-outline" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => { setPage(p); persistUi({ page: p }); }} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-low'}`}>{p}</button>
            ))}
            <button disabled={page === totalPages} onClick={() => { const next = page + 1; setPage(next); persistUi({ page: next }); }} className="p-2 rounded-lg hover:bg-surface-low transition-colors disabled:opacity-40">
              <ChevronRight size={16} className="text-outline" />
            </button>
          </div>
        )}
      </AsyncState>
    </div>
  );
}

function estimateRefundAmount(booking) {
  if (booking.status !== 'CONFIRMED') return 0;
  const start = new Date(`${booking.date}T${booking.startTime}:00`).getTime();
  const diffHours = (start - Date.now()) / (60 * 60 * 1000);
  const policy = booking.policySnapshot || {};
  if (diffHours >= (policy.refundBeforeHours ?? 24)) {
    return Math.round((booking.totalAmount || 0) * ((policy.refundPercent ?? 100) / 100));
  }
  return 0;
}

function BookingActions({ booking, onDone, courtsList }) {
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  /** Khách chỉ được tự hủy khi đang chờ thanh toán (đã xác nhận thì liên hệ nhân viên / chính sách riêng). */
  const canCancel = ['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status);
  const canReschedule = booking.status === 'CONFIRMED';

  const handleCancel = async (refundRecipient = {}) => {
    setCancelling(true);
    try {
      await bookingsApi.cancel(booking.id, { cancelReason: 'Khach hang tu huy', ...refundRecipient });
      toast.success('Đã hủy booking thành công.');
      setShowCancelModal(false);
      onDone();
    } catch (err) {
      toast.error(err.message || 'Hủy thất bại.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 mt-3">
        {canCancel && (
          <button onClick={() => setShowCancelModal(true)} disabled={cancelling}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-error bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60">
            {cancelling ? 'Đang hủy...' : 'Hủy booking'}
          </button>
        )}
        {canReschedule && (
          <button onClick={() => setShowReschedule(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary-fixed/10 hover:bg-primary-fixed/20 transition-colors">
            <CalendarSync size={12} /> Đổi lịch
          </button>
        )}
      </div>
      {showReschedule && (
        <RescheduleModal booking={booking} courtsList={courtsList} onClose={() => setShowReschedule(false)} onDone={onDone} />
      )}
      {showCancelModal && (
        <CancelBookingModal
          booking={booking}
          submitting={cancelling}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancel}
        />
      )}
    </>
  );
}

function CancelBookingModal({ booking, submitting, onClose, onConfirm }) {
  const refundAmount = estimateRefundAmount(booking);
  const needsRefundInfo = refundAmount > 0;
  const [refundBankName, setRefundBankName] = useState('');
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [refundAccountName, setRefundAccountName] = useState('');

  const canSubmit = !submitting && (
    !needsRefundInfo ||
    (refundBankName.trim() && refundAccountNumber.trim() && refundAccountName.trim())
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm(needsRefundInfo ? {
      refundBankName: refundBankName.trim(),
      refundAccountNumber: refundAccountNumber.trim(),
      refundAccountName: refundAccountName.trim(),
    } : {});
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        className="w-full max-w-md rounded-xl bg-surface-lowest p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-red-50 p-2 text-error">
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 id="cancel-booking-title" className="text-base font-semibold text-on-surface">Xác nhận hủy booking</h3>
              <p className="mt-1 text-xs text-on-surface-variant">
                Booking {booking.bookingCode} sẽ được hủy sau khi xác nhận.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="text-outline hover:text-on-surface disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-surface-low p-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-on-surface-variant">Số tiền dự kiến hoàn</span>
            <span className="font-semibold text-primary">{formatPrice(refundAmount)}</span>
          </div>
          {!needsRefundInfo && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Booking này không phát sinh hoàn tiền theo chính sách hiện tại.
            </p>
          )}
        </div>

        {needsRefundInfo && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-on-surface mb-1">Ngân hàng nhận hoàn tiền</label>
              <input
                value={refundBankName}
                onChange={(e) => setRefundBankName(e.target.value)}
                placeholder="VD: Vietcombank"
                className="w-full h-10 px-3 rounded-lg bg-surface-low text-on-surface text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface mb-1">Số tài khoản</label>
              <input
                value={refundAccountNumber}
                onChange={(e) => setRefundAccountNumber(e.target.value)}
                placeholder="Nhập số tài khoản"
                className="w-full h-10 px-3 rounded-lg bg-surface-low text-on-surface text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface mb-1">Tên chủ tài khoản</label>
              <input
                value={refundAccountName}
                onChange={(e) => setRefundAccountName(e.target.value)}
                placeholder="Tên trên tài khoản ngân hàng"
                className="w-full h-10 px-3 rounded-lg bg-surface-low text-on-surface text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-low transition-colors disabled:opacity-50"
          >
            Giữ booking
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-error hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting ? 'Đang hủy...' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function RescheduleModal({ booking, courtsList = [], onClose, onDone }) {
  const toast = useToast();
  const [selectedCourtId, setSelectedCourtId] = useState(booking.courtId);
  const [date, setDate] = useState(booking.date);
  const [startTime, setStartTime] = useState(booking.startTime);
  const [endTime, setEndTime] = useState(booking.endTime);
  const [refundBankName, setRefundBankName] = useState('');
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [refundAccountName, setRefundAccountName] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selectableCourts = courtsList.filter((court) => court.status === 'ACTIVE' || court.id === booking.courtId);
  const courtOptions = selectableCourts.length ? selectableCourts : [{ id: booking.courtId, name: booking.courtId }];

  const loadSlots = useCallback(async (courtId, nextDate) => {
    if (!courtId || !nextDate) {
      setSlots([]);
      return;
    }
    setLoading(true);
    try {
      const data = await courtsApi.getAvailability(courtId, nextDate);
      const items = data.slots || data.items || (Array.isArray(data) ? data : []);
      setSlots(items.filter((s) => s.status === 'AVAILABLE' || s.status === 'available'));
    } catch { setSlots([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadSlots(selectedCourtId, date);
  }, [selectedCourtId, date, loadSlots]);

  const handleCourtChange = (courtId) => {
    setSelectedCourtId(courtId);
    setStartTime('');
    setEndTime('');
  };

  const handleDateChange = (nextDate) => {
    setDate(nextDate);
    setStartTime('');
    setEndTime('');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await bookingsApi.reschedule(booking.id, {
        courtId: selectedCourtId,
        date,
        startTime,
        endTime,
        refundBankName: refundBankName || undefined,
        refundAccountNumber: refundAccountNumber || undefined,
        refundAccountName: refundAccountName || undefined,
        paymentScenario: { providerStatus: 'success', autoWebhook: true },
      });
      toast.success('Đổi lịch thành công!');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Đổi lịch thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 bg-surface-low rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-on-surface">Đổi lịch booking</h4>
        <button onClick={onClose} className="text-outline hover:text-on-surface"><X size={16} /></button>
      </div>

      <div>
        <label className="block text-xs font-medium text-on-surface mb-1">Ngày mới</label>
        <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full h-9 px-3 rounded-lg bg-surface-lowest text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border" />
      </div>

      <div>
        <label className="block text-xs font-medium text-on-surface mb-1">Sân mới</label>
        <select value={selectedCourtId} onChange={(e) => handleCourtChange(e.target.value)}
          className="w-full h-9 px-3 rounded-lg bg-surface-lowest text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border">
          {courtOptions.map((court) => (
            <option key={court.id} value={court.id}>{court.name || court.id}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-16 flex items-center justify-center"><span className="text-xs text-on-surface-variant">Đang tải...</span></div>
      ) : slots.length > 0 ? (
        <div>
          <label className="block text-xs font-medium text-on-surface mb-1">Chọn giờ</label>
          <div className="grid grid-cols-3 gap-2 max-h-28 overflow-y-auto">
            {slots.map((s, i) => (
              <button key={i} onClick={() => { setStartTime(s.startTime); setEndTime(s.endTime); }}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  startTime === s.startTime && endTime === s.endTime
                    ? 'bg-primary text-white'
                    : 'bg-surface-lowest text-on-surface hover:bg-primary-fixed/20 border border-outline-variant/20'
                }`}>
                {s.startTime} - {s.endTime}
              </button>
            ))}
          </div>
        </div>
      ) : date !== booking.date ? (
        <p className="text-xs text-on-surface-variant text-center">Không có giờ trống.</p>
      ) : null}

      <div className="text-xs text-on-surface-variant">
        Giờ đã chọn: <span className="font-semibold text-on-surface">{startTime && endTime ? `${date} | ${startTime} - ${endTime}` : 'Chưa chọn khung giờ'}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input value={refundBankName} onChange={(e) => setRefundBankName(e.target.value)} placeholder="Ngân hàng hoàn tiền"
          className="h-9 px-3 rounded-lg bg-surface-lowest text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border" />
        <input value={refundAccountNumber} onChange={(e) => setRefundAccountNumber(e.target.value)} placeholder="Số tài khoản"
          className="h-9 px-3 rounded-lg bg-surface-lowest text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border" />
        <input value={refundAccountName} onChange={(e) => setRefundAccountName(e.target.value)} placeholder="Tên chủ tài khoản"
          className="h-9 px-3 rounded-lg bg-surface-lowest text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border" />
      </div>

      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={submitting || !selectedCourtId || !date || !startTime || !endTime}
          className="flex-1 py-2 rounded-lg font-semibold text-white gradient-primary hover:opacity-90 transition-opacity disabled:opacity-60 text-xs">
          {submitting ? 'Đang xử lý...' : 'Xác nhận'}
        </button>
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-lowest transition-colors">
          Hủy
        </button>
      </div>
    </div>
  );
}
