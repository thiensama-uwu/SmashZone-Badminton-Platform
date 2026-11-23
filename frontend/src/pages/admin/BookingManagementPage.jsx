import { useState, useCallback, useTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, Filter, Plus, X, Calendar, CheckCircle, DollarSign, Undo2 } from 'lucide-react';
import { bookingsApi } from '../../api/bookings';
import { courtsApi } from '../../api/courts';
import { useApi, clearCache } from '../../hooks/useApi';
import AsyncState from '../../components/AsyncState';
import { useToast } from '../../contexts/useToast';

const statusConfig = {
  PENDING_HOLD:    { label: 'Chờ giữ chỗ', cls: 'bg-blue-50 text-blue-700' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', cls: 'bg-amber-50 text-amber-700' },
  CONFIRMED:       { label: 'Đã xác nhận', cls: 'bg-emerald-50 text-emerald-700' },
  CHECKED_IN:      { label: 'Đã check-in', cls: 'bg-green-50 text-green-700' },
  COMPLETED:       { label: 'Hoàn thành', cls: 'bg-teal-50 text-teal-700' },
  CANCELLED:       { label: 'Đã hủy', cls: 'bg-red-50 text-error' },
  REFUND_PENDING:  { label: 'Chờ hoàn tiền', cls: 'bg-orange-50 text-orange-700' },
  REFUNDED:        { label: 'Đã hoàn tiền', cls: 'bg-surface-high text-on-surface-variant' },
  EXPIRED:         { label: 'Hết hạn', cls: 'bg-surface-high text-outline' },
};

const PAGE_SIZE = 12;
const QUICK_FILTERS = ['Tất cả', 'CONFIRMED', 'PENDING_PAYMENT', 'CHECKED_IN'];
const SLOT_OPTIONS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

function nextHour(time) {
  const [h, m] = String(time).split(':').map(Number);
  const next = String((h + 1) % 24).padStart(2, '0');
  return `${next}:${String(m || 0).padStart(2, '0')}`;
}

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

export default function BookingManagementPage() {
  const toast = useToast();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Tất cả');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetcher = useCallback(() => {
    const params = { limit: 1000 };
    if (dateFilter) params.date = dateFilter;
    if (filter !== 'Tất cả') params.status = filter;
    return bookingsApi.listAll(params);
  }, [dateFilter, filter]);

  const { data, loading, error, refresh } = useApi(
    `admin:bookings:${filter}:${dateFilter}`,
    fetcher,
    { ttlMs: 30_000, onError: (err) => toast.error(err.message || 'Không thể tải danh sách booking.') },
  );

  // Load courts for name resolution (YC16)
  const courtsFetcher = useCallback(() => courtsApi.list({ includeInactive: true }), []);
  const { data: courtsData } = useApi('admin:courts:all', courtsFetcher, { ttlMs: 120_000 });
  const courtsList = courtsData?.items || (Array.isArray(courtsData) ? courtsData : []);
  const getCourtName = (courtId) => {
    const court = courtsList.find(c => c.id === courtId);
    return court?.name || courtId;
  };
  // YC16: Get customer name from booking data
  const getCustomerName = (booking) => {
    if (booking.origin === 'staff_manual') {
      return booking.manualCustomerName || booking.customerName || 'Vãng lai';
    }
    return booking.userName || booking.userFullName || booking.customerName || booking.userId || '—';
  };

  const bookings = data?.items || (Array.isArray(data) ? data : []);
  const queryBookingId = new URLSearchParams(location.search).get('bookingId') || '';

  const filtered = bookings.filter(b => {
    if (queryBookingId) return b.id === queryBookingId;
    // Exclude cancelled bookings from default view
    if (b.status === 'CANCELLED') return false;
    if (!search) return true;
    return b.bookingCode?.toLowerCase().includes(search.toLowerCase()) || b.id === search;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const doRefresh = () => {
    clearCache('admin:bookings');
    refresh();
  };

  const handleCheckIn = (bookingId) => {
    startTransition(async () => {
      try {
        await bookingsApi.checkIn(bookingId);
        toast.success('Check-in thành công!');
        setSelected(null);
        doRefresh();
      } catch (err) {
        toast.error(err.message || 'Check-in thất bại.');
      }
    });
  };

  const handleCancel = (bookingId) => {
    startTransition(async () => {
      try {
        await bookingsApi.cancel(bookingId, 'staff_request');
        toast.success('Đã hủy booking.');
        setSelected(null);
        doRefresh();
      } catch (err) {
        toast.error(err.message || 'Hủy thất bại.');
      }
    });
  };

  const handleConfirmPayment = (bookingId) => {
    startTransition(async () => {
      try {
        await bookingsApi.confirmPayment(bookingId);
        toast.success('Đã xác nhận thanh toán.');
        setSelected(null);
        doRefresh();
      } catch (err) {
        toast.error(err.message || 'Xác nhận thanh toán thất bại.');
      }
    });
  };

  const handleProcessRefund = () => {
    window.location.href = '/admin/refunds';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-on-surface">Quản lý booking</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-active transition-opacity">
            <Plus size={16} /> Tạo booking
          </button>
          <button onClick={doRefresh} className="p-2 rounded-lg border border-outline-variant/30 hover:bg-surface-low transition-colors">
            <RefreshCw size={16} className={`text-on-surface-variant ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-background rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-on-surface">Chi tiết booking</h2>
              <button onClick={() => setSelected(null)} className="text-outline hover:text-on-surface"><X size={20} /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Mã booking', <span key="code" className="font-mono">{selected.bookingCode}</span>],
                ['Khách hàng', getCustomerName(selected)],
                ['Sân', getCourtName(selected.courtId)],
                ['Ngày', selected.date],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="text-on-surface text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-start">
                <span className="text-on-surface-variant">Giờ</span>
                <span className="text-on-surface text-right max-w-[60%] whitespace-pre-line">{formatBookingSlots(selected.reservations, selected.startTime, selected.endTime)}</span>
              </div>
              {[
                ['Tổng tiền', <span key="amt" className="font-bold text-amber-500">{selected.totalAmount?.toLocaleString('vi-VN')}đ</span>],
                ['Trạng thái', (
                  <span key="st" className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusConfig[selected.status]?.cls || 'bg-surface-high text-on-surface-variant'}`}>
                    {statusConfig[selected.status]?.label || selected.status}
                  </span>
                )],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="text-on-surface text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5 flex-wrap">
              <button onClick={() => setSelected(null)} className="flex-1 h-10 rounded-xl font-medium text-on-surface border border-outline-variant/30 hover:bg-surface-low">Đóng</button>

              {selected.status === 'PENDING_PAYMENT' && (
                <button onClick={() => handleConfirmPayment(selected.id)} disabled={isPending}
                  className="flex-1 h-10 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1">
                  <DollarSign size={14} /> Xác nhận TT
                </button>
              )}

              {selected.status === 'CONFIRMED' && (
                <button onClick={() => handleCheckIn(selected.id)} disabled={isPending}
                  className="flex-1 h-12 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-60">
                  Check-in
                </button>
              )}

              
              {selected.status === 'REFUND_PENDING' && (
                <button onClick={() => handleProcessRefund(selected)} disabled={isPending}
                  className="flex-1 h-10 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1">
                  <Undo2 size={14} /> Xử lý hoàn tiền
                </button>
              )}

              {selected.status === 'PENDING_PAYMENT' && (
                <button onClick={() => handleCancel(selected.id)} disabled={isPending}
                  className="flex-1 h-10 rounded-xl font-semibold text-white bg-error hover:opacity-90 disabled:opacity-60">
                  Hủy
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input type="text" placeholder="Tìm theo mã booking..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-low text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border" />
        </div>
        <div className="relative">
          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
          <input type="date" value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setPage(1); }}
            className="h-10 pl-9 pr-3 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border" />
        </div>
        {dateFilter && (
          <button onClick={() => setDateFilter('')} className="h-10 px-3 rounded-lg text-xs font-medium text-error hover:bg-red-50 transition-colors flex items-center gap-1">
            <X size={14} /> Bỏ lọc ngày
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <Filter size={14} className="text-outline" />
        {QUICK_FILTERS.map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-surface-high text-on-surface-variant hover:bg-surface-container'}`}>
            {f === 'Tất cả' ? 'Tất cả' : (statusConfig[f]?.label || f)}
          </button>
        ))}
      </div>

      {/* Table */}
      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && filtered.length === 0}
        skeletonType="table"
        skeletonRows={6}
        skeletonCols={5}
        emptyText="Không tìm thấy booking nào."
        retryFn={doRefresh}
      >
        <div className="bg-surface-lowest rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {['Mã booking', 'Ngày đặt', 'Khách hàng', 'Trạng thái', 'Tổng tiền', ''].map((h, i) => (
                  <th key={i} className={`text-left p-4 font-semibold text-on-surface-variant ${i === 1 ? 'hidden sm:table-cell' : ''} ${i === 2 ? 'hidden sm:table-cell' : ''} ${i === 4 ? 'text-right hidden lg:table-cell' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(b => {
                const status = statusConfig[b.status] || { label: b.status, cls: 'bg-surface-high text-on-surface-variant' };
                return (
                  <tr key={b.id} className="border-b border-outline-variant/10 hover:bg-surface-low transition-colors cursor-pointer" onClick={() => setSelected(b)}>
                    <td className="p-4 font-mono font-medium text-on-surface">{b.bookingCode}</td>
                    <td className="p-4 text-on-surface-variant hidden sm:table-cell">{formatBookingDate(b.createdAt)}</td>
                    {/* YC16: Customer name instead of ID */}
                    <td className="p-4 text-on-surface-variant hidden sm:table-cell">{getCustomerName(b)}</td>
                    <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.cls}`}>{status.label}</span></td>
                    <td className="p-4 text-right font-semibold text-on-surface hidden lg:table-cell">{b.totalAmount?.toLocaleString('vi-VN')}đ</td>
                    <td className="p-4 text-right">
                      <span className="text-xs font-medium text-amber-500">Chi tiết</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-5">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-low disabled:opacity-40">← Trước</button>
            <span className="text-sm text-on-surface-variant">Trang {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-low disabled:opacity-40">Sau →</button>
          </div>
        )}
      </AsyncState>

      {showCreate && <StaffCreateModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); doRefresh(); }} />}
    </div>
  );
}

function StaffCreateModal({ onClose, onDone }) {
  const toast = useToast();
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState('');
  const [selectedStarts, setSelectedStarts] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [billStatus, setBillStatus] = useState('pending');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const courtsFetcher = useCallback(() => courtsApi.list(), []);
  const { data: courtsData } = useApi('staff:courts', courtsFetcher, { ttlMs: 60_000 });
  const courts = courtsData?.items || (Array.isArray(courtsData) ? courtsData : []);

  const loadSlots = async (cId, d) => {
    if (!cId || !d) return;
    setSlotsLoading(true);
    try {
      const data = await courtsApi.getAvailability(cId, d);
      const items = data.slots || data.items || (Array.isArray(data) ? data : []);
      setSlots(items);
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); }
  };

  const handleCourtChange = (cId) => {
    setCourtId(cId);
    setSelectedStarts([]);
    if (date) loadSlots(cId, date);
  };

  const handleDateChange = (d) => {
    setDate(d);
    setSelectedStarts([]);
    if (courtId) loadSlots(courtId, d);
  };

  const availableStarts = new Set(
    slots
      .filter((s) => String(s.status || '').toUpperCase() === 'AVAILABLE')
      .map((s) => s.startTime)
  );

  const toggleStartTime = (startTime) => {
    if (!availableStarts.has(startTime)) return;
    setSelectedStarts((prev) => {
      if (prev.includes(startTime)) {
        return prev.filter((s) => s !== startTime);
      }
      if (prev.length >= 2) {
        toast.error('Chỉ được chọn tối đa 2 khung giờ mỗi lần tạo booking.');
        return prev;
      }
      return [...prev, startTime].sort();
    });
  };

  // YC17: Validate all fields
  const handleSubmit = async () => {
    const errors = {};
    if (!courtId) errors.courtId = 'Vui lòng chọn sân.';
    if (!date) errors.date = 'Vui lòng chọn ngày.';
    if (selectedStarts.length === 0) errors.time = 'Vui lòng chọn ít nhất 1 khung giờ.';
    if (selectedStarts.length > 2) errors.time = 'Tối đa 2 khung giờ.';
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error('Vui lòng chọn đủ thông tin bắt buộc.');
      return;
    }
    setValidationErrors({});
    setSubmitting(true);
    try {
      await bookingsApi.staffCreate({
        courtId,
        date,
        startTime: selectedStarts[0],
        endTime: nextHour(selectedStarts[selectedStarts.length - 1]),
        selectedSlots: selectedStarts,
        customerName: customerName.trim() || 'Vãng lai',
        customerPhone: customerPhone.trim() || null,
        billStatus,
        paymentScenario: { providerStatus: billStatus === 'paid' ? 'success' : 'fail', autoWebhook: false },
      });
      toast.success('Tạo booking thành công!');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Tạo booking thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-lowest rounded-2xl p-6 shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-on-surface">Tạo booking thủ công</h3>
          <button onClick={onClose} className="text-outline hover:text-on-surface"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Chọn sân</label>
            <select value={courtId} onChange={e => handleCourtChange(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border">
              <option value="">-- Chọn sân --</option>
              {courts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Ngày</label>
            <input type="date" value={date} onChange={e => handleDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full h-10 px-3 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border" />
          </div>

          {slotsLoading ? (
            <div className="h-20 flex items-center justify-center"><span className="text-sm text-on-surface-variant">Đang tải lịch trống...</span></div>
          ) : courtId && date ? (
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">Chọn giờ trống</label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {SLOT_OPTIONS.map((startTime) => {
                  const disabled = !availableStarts.has(startTime);
                  const selected = selectedStarts.includes(startTime);
                  return (
                    <button key={startTime} onClick={() => toggleStartTime(startTime)} disabled={disabled}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      disabled
                        ? 'bg-surface-high text-outline cursor-not-allowed opacity-70'
                        : selected
                          ? 'bg-primary text-white'
                          : 'bg-surface-low text-on-surface hover:bg-primary-fixed/20 border border-outline-variant/20'
                    }`}>
                    {startTime} - {nextHour(startTime)}
                  </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1.5">Tối đa 2 khung giờ, chỉ cho phép ngày hiện tại trở đi.</p>
              {validationErrors.time && <p className="text-xs text-error mt-1">{validationErrors.time}</p>}
            </div>
          ) : null}

          {/* YC17: Customer info fields */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">
              Tên khách hàng
            </label>
            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="Nhập họ tên khách hàng"
              className={`w-full h-10 px-3 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border ${validationErrors.customerName ? 'border-error ring-1 ring-error' : ''}`} />
            {validationErrors.customerName && (
              <p className="text-xs text-error mt-1">{validationErrors.customerName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">
              Số điện thoại
            </label>
            <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              placeholder="VD: 0901234567"
              className={`w-full h-10 px-3 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border ${validationErrors.customerPhone ? 'border-error ring-1 ring-error' : ''}`} />
            {validationErrors.customerPhone && (
              <p className="text-xs text-error mt-1">{validationErrors.customerPhone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Trạng thái hóa đơn</label>
            <select
              value={billStatus}
              onChange={(e) => setBillStatus(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border"
            >
              <option value="pending">Chờ thanh toán</option>
              <option value="paid">Đã thanh toán</option>
            </select>
          </div>

          {selectedStarts.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3 text-sm">
              Đã chọn: <span className="font-semibold text-amber-500">{date} | {selectedStarts.map((s) => `${s}-${nextHour(s)}`).join(', ')}</span>
              {customerName && <span className="block text-xs text-on-surface-variant mt-1">Khách hàng: {customerName}</span>}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={submitting || !courtId || !date || selectedStarts.length === 0}
              className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-primary hover:bg-primary-active transition-opacity disabled:opacity-60">
              {submitting ? 'Đang tạo...' : 'Xác nhận tạo booking'}
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-low transition-colors">
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
