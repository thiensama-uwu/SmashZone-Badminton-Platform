import { useState, useEffect, useTransition } from 'react';
import { bookingsApi } from '../../api/bookings';
import { courtsApi } from '../../api/courts';
import { useAuth } from '../../contexts/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Star, ChevronLeft, ChevronRight, CreditCard, AlertCircle, MapPin } from 'lucide-react';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const monthNames = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
function formatVNDate(d) {
  const days = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function formatPrice(n) { return n?.toLocaleString('vi-VN') + 'đ'; }
function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function isSlotAvailable(slot) {
  return String(slot?.status || '').trim().toUpperCase() === 'AVAILABLE';
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isPastSlot(selectedDate, slot) {
  const now = new Date();
  if (toDateStr(selectedDate) !== toDateStr(now)) return false;
  return toMinutes(slot?.startTime) < (now.getHours() * 60 + now.getMinutes());
}

function groupSelectedSlots(slots = []) {
  const sorted = [...slots].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  if (!sorted.length) return [];
  const groups = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const prev = groups[groups.length - 1][groups[groups.length - 1].length - 1];
    if (toMinutes(prev.endTime) === toMinutes(current.startTime)) {
      groups[groups.length - 1].push(current);
    } else {
      groups.push([current]);
    }
  }
  return groups.map((g) => ({
    startTime: g[0].startTime,
    endTime: g[g.length - 1].endTime,
    count: g.length,
  }));
}

export default function BookingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const today = new Date();
  const [courts, setCourts] = useState([]);
  const [courtSearch, setCourtSearch] = useState('');
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const PEAK_SURCHARGE = 20000; // YC3: Phi phụ thu giờ tối 19:00-22:00

  // Load courts
  useEffect(() => {
    courtsApi.list({ includeInactive: false })
      .then((data) => {
        const items = data.items || data;
        setCourts(items);
        if (items.length > 0) {
          const preferredCourtId = location.state?.courtId;
          const preferred = preferredCourtId ? items.find((c) => c.id === preferredCourtId) : null;
          setSelectedCourt(preferred || items[0]);
        }
      })
      .catch(() => setError('Không thể tải danh sách sân.'))
      .finally(() => setLoadingCourts(false));
  }, []);

  // Load availability when court or date changes
  useEffect(() => {
    if (!selectedCourt) return;
    setLoadingSlots(true);
    setSelectedSlots([]);
    const dateStr = toDateStr(selectedDate);
    courtsApi.getAvailability(selectedCourt.id, dateStr)
      .then((data) => setAvailability(data.slots || []))
      .catch(() => setAvailability([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedCourt, selectedDate]);

  const filteredCourts = courts.filter((c) =>
    c.name.toLowerCase().includes(courtSearch.toLowerCase())
  );

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDay(currentYear, currentMonth);
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  const isSelected = (day) => day === selectedDate.getDate() && currentMonth === selectedDate.getMonth() && currentYear === selectedDate.getFullYear();
  const isPast = (day) => new Date(currentYear, currentMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const price = selectedCourt?.priceSchedules?.[0]?.price || selectedCourt?.price || 0;

  // YC3: Calculate total with surcharge for evening hours 19:00-22:00
  const calculateTotal = () => {
    if (selectedSlots.length === 0) return 0;
    let total = selectedSlots.length * price;
    // Add surcharge for evening hours 19:00-22:00
    selectedSlots.forEach(slot => {
      if (slot.startTime === '19:00' || slot.startTime === '20:00' || slot.startTime === '21:00') {
        total += PEAK_SURCHARGE;
      }
    });
    return total;
  };

  const totalPrice = calculateTotal();
  const groupedSelectedSlots = groupSelectedSlots(selectedSlots);
  const hasSurcharge = selectedSlots.some(s => s.startTime === '19:00' || s.startTime === '20:00' || s.startTime === '21:00');

  // Handle multi-slot toggle
  const handleSlotToggle = (slot) => {
    const isSelected = selectedSlots.some(s => s.startTime === slot.startTime);
    if (isSelected) {
      setSelectedSlots(prev => prev.filter(s => s.startTime !== slot.startTime));
    } else {
      setError('');
      setSelectedSlots(prev => [...prev, slot]);
    }
  };

  const handleBook = () => {
    if (selectedSlots.length === 0 || !selectedCourt) return;
    setError('');
    const groups = groupSelectedSlots(selectedSlots);
    if (groups.length === 0) return;

    startTransition(async () => {
      try {
        const idempotencyKey = `hold-${user?.sub || 'guest'}-${Date.now()}`;
        const segments = groups
          .map((g) => ({ startTime: g.startTime, endTime: g.endTime }))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        console.log('Sending hold request:', {
          courtId: selectedCourt.id,
          date: toDateStr(selectedDate),
          segments,
          paymentScenario: { providerStatus: 'success', autoWebhook: false },
        });
        const holdResult = await bookingsApi.hold({
          courtId: selectedCourt.id,
          date: toDateStr(selectedDate),
          segments,
          paymentScenario: { providerStatus: 'success', autoWebhook: false },
        }, idempotencyKey);

        const booking = await bookingsApi.create(holdResult.booking.id);
        navigate('/customer/payment', { state: { bookingId: booking.id, totalAmount: totalPrice } });
      } catch (err) {
        console.error('Booking error:', err);
        setError(err.message || 'Đặt sân thất bại. Vui lòng thử lại.');
      }
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
      {/* Left: Court Selection */}
      <div className="lg:w-[280px] border-r border-outline-variant/20 bg-surface-lowest p-4 overflow-y-auto shrink-0">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-3">Chọn sân</h2>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text" placeholder="Tìm sân..."
            value={courtSearch} onChange={(e) => setCourtSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-low text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border transition-all"
          />
        </div>
        {loadingCourts ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-low animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCourts.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedCourt(c); setSelectedSlots([]); }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                  selectedCourt?.id === c.id
                    ? 'bg-primary-fixed/15 border-l-[3px] border-primary'
                    : 'hover:bg-surface-low border-l-[3px] border-transparent'
                }`}
              >
                {/* YC1: Show small court demo image */}
                <div className="w-14 h-10 rounded-lg bg-surface-low flex items-center justify-center shrink-0 overflow-hidden">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-outline">🏸</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${selectedCourt?.id === c.id ? 'text-primary' : 'text-on-surface'}`}>{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-high text-on-surface-variant">
                      {c.branchId === 'branch_hn_1' ? 'Hà Nội' : 'Đà Nẵng'}
                    </span>
                    {c.latitude && c.longitude && (
                      <span className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                        <MapPin size={10} />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center: Calendar + Slots */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-lg font-bold text-on-surface mb-4">Chọn ngày & giờ</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-surface-lowest rounded-2xl p-5 shadow-ambient mb-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); }} className="p-1.5 rounded-lg hover:bg-surface-low transition-colors">
              <ChevronLeft size={18} className="text-on-surface-variant" />
            </button>
            <span className="text-sm font-semibold text-on-surface">{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); }} className="p-1.5 rounded-lg hover:bg-surface-low transition-colors">
              <ChevronRight size={18} className="text-on-surface-variant" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((d) => <div key={d} className="text-center text-xs font-medium text-outline py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => (
              <button key={i} disabled={!day || isPast(day)}
                onClick={() => day && !isPast(day) && setSelectedDate(new Date(currentYear, currentMonth, day))}
                className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                  !day ? '' : isSelected(day) ? 'bg-primary text-white' :
                  isToday(day) ? 'bg-primary-fixed/20 text-primary font-bold' :
                  isPast(day) ? 'text-outline/40 cursor-not-allowed' : 'text-on-surface hover:bg-surface-low'
                }`}
              >{day || ''}</button>
            ))}
          </div>
        </div>

        {/* Time Slots */}
        <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-3">
          Khung giờ — {formatVNDate(selectedDate)}
        </h3>
        {loadingSlots ? (
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-11 rounded-lg bg-surface-low animate-pulse" />)}
          </div>
        ) : availability.length === 0 ? (
          <p className="text-sm text-on-surface-variant italic">Không có khung giờ nào cho ngày này.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {availability.map((slot) => {
                const booked = !isSlotAvailable(slot);
                const pastSlot = isPastSlot(selectedDate, slot);
                const disabled = booked || pastSlot;
                const sel = selectedSlots.some(s => s.startTime === slot.startTime);
                const isPeakHour = slot.startTime === '19:00' || slot.startTime === '20:00' || slot.startTime === '21:00';
                return (
                  <button key={slot.startTime} disabled={disabled}
                    onClick={() => !disabled && handleSlotToggle(slot)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all relative ${
                      disabled ? 'bg-surface-high text-outline line-through cursor-not-allowed' :
                      sel ? 'gradient-primary text-white shadow-sm' :
                      'bg-surface-lowest border border-outline-variant/20 text-on-surface hover:border-primary-container hover:text-primary'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{slot.startTime}</span>
                      <span className="text-[10px] opacity-60">—</span>
                      <span>{slot.endTime}</span>
                    </div>
                    {isPeakHour && !booked && (
                      <span className="block text-[10px] mt-0.5 opacity-80">+20.000đ</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="flex gap-4 mt-4 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-surface-lowest border border-outline-variant/20" /> Trống</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded gradient-primary" /> Đã chọn</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-surface-high" /> Đã đặt</span>
        </div>
      </div>

      {/* Right: Summary */}
      <div className="lg:w-[320px] border-l border-outline-variant/20 bg-surface-lowest p-5 overflow-y-auto shrink-0">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-4">Tóm tắt đặt sân</h2>

        {selectedCourt && (
          <div className="bg-surface-low rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-on-surface">{selectedCourt.name}</p>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-container text-white">
              {selectedCourt.branchId === 'branch_hn_1' ? 'Hà Nội' : 'Đà Nẵng'}
            </span>
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Ngày</span>
            <span className="font-medium text-on-surface">{formatVNDate(selectedDate)}</span>
          </div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-on-surface-variant">Khung giờ</span>
            <div className="text-right">
              {groupedSelectedSlots.length > 0 ? groupedSelectedSlots.map((slot, idx) => (
                <p key={`${slot.startTime}-${slot.endTime}-${idx}`} className="font-medium text-on-surface">
                  {slot.startTime} - {slot.endTime}
                </p>
              )) : <span className="text-outline italic text-xs">Chưa chọn</span>}
            </div>
          </div>
          {selectedSlots.length > 0 && (
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Số khung giờ</span>
              <span className="font-medium text-on-surface">{selectedSlots.length} giờ</span>
            </div>
          )}
        </div>

        {/* Surcharge note for YC3 */}
        {hasSurcharge && (
          <div className="bg-amber-50 rounded-lg p-2.5 text-xs text-amber-700 mt-3">
            ⚡ Phụ thu giờ tối 19:00-22:00: +{PEAK_SURCHARGE.toLocaleString('vi-VN')}đ mỗi khung giờ
          </div>
        )}

        <div className="border-t border-outline-variant/20 my-4" />
        {selectedSlots.length > 0 && (
          <div className="space-y-1 text-sm mb-2">
            <div className="flex justify-between text-on-surface-variant">
              <span>Giá sân ({selectedSlots.length} giờ)</span>
              <span>{formatPrice(selectedSlots.length * price)}</span>
            </div>
            {hasSurcharge && (
              <div className="flex justify-between text-amber-600">
                <span>Phụ thu giờ vàng</span>
                <span>+{formatPrice(PEAK_SURCHARGE)}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span className="text-on-surface">Tổng cộng</span>
          <span className="text-primary">{selectedSlots.length > 0 ? formatPrice(totalPrice) : '—'}</span>
        </div>

        <button
          disabled={selectedSlots.length === 0 || isPending}
          onClick={handleBook}
          className="w-full mt-5 py-3 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2"
        >
          {isPending ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xử lý...</>
          ) : (
            <><CreditCard size={16} /> Tiến hành thanh toán</>
          )}
        </button>
        <p className="text-center text-[11px] text-outline mt-2">Bạn sẽ thanh toán ở bước kế tiếp (không tự động trừ tiền ngay).</p>
      </div>
    </div>
  );
}
