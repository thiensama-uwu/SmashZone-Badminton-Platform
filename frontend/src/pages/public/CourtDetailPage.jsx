import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { MapPin, Star, Wifi, Car, ShirtIcon, Coffee, Wind, Lightbulb, Clock, CalendarSync, ChevronRight, X, ZoomIn, ZoomOut, Plus, Minus } from 'lucide-react';
import { courtsApi } from '../../api/courts';
import { CourtMap } from '../../components/shared/MapComponent';

const amenities = [
  { icon: Wifi, label: 'WiFi' },
  { icon: Car, label: 'Bãi đỗ xe' },
  { icon: ShirtIcon, label: 'Phòng thay đồ' },
  { icon: Coffee, label: 'Căng tin' },
  { icon: Wind, label: 'Máy lạnh' },
  { icon: Lightbulb, label: 'Đèn LED' },
];

const BRANCH_LOCATION_MAP = {
  branch_hcm_1: 'Đà Nẵng',
  branch_dn_1: 'Đà Nẵng',
  branch_hn_1: 'Hà Nội',
};
const STATUS_MAP = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Tạm nghỉ', MAINTENANCE: 'Bảo trì' };
const DEFAULT_IMAGE = '/courts/default-court.svg';

export default function CourtDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [courtData, setCourtData] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    courtsApi.get(slug)
      .then((c) => {
        const policy = c.policies?.[0] || {};
        // Build images array: first image is banner, rest are thumbnails
        const allImages = [];
        if (c.imageUrl) allImages.push(c.imageUrl);
        if (c.additionalImages && Array.isArray(c.additionalImages)) {
          allImages.push(...c.additionalImages);
        }
        // Ensure at least 1 image (banner)
        if (allImages.length === 0) allImages.push(DEFAULT_IMAGE);

        setCourtData({
          ...c,
          locationLabel: BRANCH_LOCATION_MAP[c.branchId] || 'Đà Nẵng',
          statusLabel: STATUS_MAP[c.status] || c.status,
          location: c.description || '',
          price: c.priceSchedules?.[0]?.price?.toLocaleString('vi-VN') || c.defaultPrice?.toLocaleString('vi-VN') || '—',
          bannerImage: allImages[0],
          thumbnailImages: allImages.slice(1, 5), // up to 4 thumbnails
          policies: [
            { icon: Clock, title: `Hoàn tiền trước ${policy.refundBeforeHours || 24}h`, desc: `Hủy trước ${policy.refundBeforeHours || 24}h được hoàn ${policy.refundPercent || 100}%.` },
            { icon: CalendarSync, title: `Đổi lịch trước ${policy.rescheduleBeforeHours || 6}h`, desc: `Đổi lịch trước giờ chơi ${policy.rescheduleBeforeHours || 6} tiếng.` },
          ],
          hasTimeSlots: !!(c.priceSchedules && c.priceSchedules.length > 0),
        });
      })
      .catch(() => setCourtData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!courtData?.id) return;
    courtsApi.getAvailability(courtData.id, selectedDate)
      .then((data) => {
        const slots = data.slots || data.items || (Array.isArray(data) ? data : []);
        setTimeSlots(slots.map((s) => ({
          time: `${s.startTime} - ${s.endTime}`,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status === 'AVAILABLE' || s.status === 'available' ? 'available' : 'booked',
        })));
      })
      .catch(() => setTimeSlots([]));
  }, [courtData?.id, selectedDate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="space-y-6">
          <div className="h-72 rounded-2xl bg-surface-low animate-pulse" />
          <div className="h-40 rounded-2xl bg-surface-low animate-pulse" />
        </div>
      </div>
    );
  }

  if (!courtData) {
    return (
      <div className="text-center py-20">
        <p className="text-on-surface-variant text-lg">Không tìm thấy sân.</p>
        <Link to="/courts" className="mt-4 inline-block text-primary font-medium hover:underline">Quay lại danh sách</Link>
      </div>
    );
  }

  const policies = courtData.policies;
  const canBook = true;
  // Build 4 thumbnail slots (fill with white placeholders if not enough)
  const thumbnails = [];
  for (let i = 0; i < 4; i++) {
    thumbnails.push(courtData.thumbnailImages[i] || null);
  }

  return (
    <>
      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
            onClick={() => setFullscreenImage(null)}
          >
            <X size={32} />
          </button>
          <img
            src={fullscreenImage}
            alt="Ảnh sân"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Breadcrumb */}
      <div className="bg-surface-soft border-b border-hairline">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3.5">
          <nav className="flex items-center gap-1.5 text-xs text-muted">
            <Link to="/" className="hover:text-ink transition-colors">Trang chủ</Link>
            <ChevronRight size={13} />
            <Link to="/courts" className="hover:text-ink transition-colors">Danh sách sân</Link>
            <ChevronRight size={13} />
            <span className="text-ink font-semibold">{courtData.name}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 bg-canvas text-ink">
        {/* Image Gallery with Banner + 4 Thumbnails (YC8) */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Main Banner */}
            <div className="md:col-span-4 rounded-xl overflow-hidden aspect-[16/7] max-h-96 relative border border-hairline shadow-sm">
              <div className="relative w-full h-full overflow-hidden">
                <img
                  src={courtData.bannerImage}
                  alt={courtData.name}
                  className="w-full h-full object-cover transition-transform duration-300"
                  style={{ transform: `scale(${zoomLevel})` }}
                />
                {/* Zoom Controls */}
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg p-1">
                  <button
                    onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.25))}
                    disabled={zoomLevel <= 1}
                    className="w-8 h-8 rounded bg-white/90 hover:bg-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Thu nhỏ"
                  >
                    <Minus size={15} className="text-ink" />
                  </button>
                  <span className="text-white text-xs font-semibold w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
                    disabled={zoomLevel >= 2}
                    className="w-8 h-8 rounded bg-white/90 hover:bg-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Phóng to"
                  >
                    <Plus size={15} className="text-ink" />
                  </button>
                </div>
              </div>
            </div>
            {/* 4 Thumbnails */}
            {thumbnails.map((thumb, i) => (
              <div
                key={i}
                className={`rounded-xl overflow-hidden aspect-[4/3] relative group border border-hairline ${thumb ? 'cursor-pointer' : 'bg-surface-soft'}`}
                onClick={() => thumb && setFullscreenImage(thumb)}
              >
                {thumb ? (
                  <img src={thumb} alt={`Ảnh sân ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                    Chưa có ảnh
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Court Info - 2 Column Layout with Sticky Reservation Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left - Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Meta */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-soft border border-hairline text-ink">
                  {courtData.locationLabel}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-fixed/40 text-primary">
                  {courtData.statusLabel}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">{courtData.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2.5">
                <div className="flex items-center gap-1">
                  <Star size={15} className="fill-ink text-ink" />
                  <span className="font-semibold text-sm text-ink">4.8</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <MapPin size={13} />
                  <span>{courtData.locationLabel}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="pt-6 border-t border-hairline">
              <h2 className="text-lg font-semibold text-ink mb-2.5">Giới thiệu về sân</h2>
              <p className="text-body text-sm leading-relaxed">{courtData.description || courtData.location || 'Sân cầu lông đạt chuẩn thi đấu, mặt thảm chống trượt cao cấp.'}</p>
            </div>

            {/* Address */}
            {courtData.address && (
              <div className="pt-6 border-t border-hairline">
                <h2 className="text-lg font-semibold text-ink mb-2.5">Vị trí địa chỉ</h2>
                <div className="flex items-start gap-2 text-body text-sm">
                  <MapPin size={16} className="shrink-0 mt-0.5 text-primary" />
                  <p className="leading-relaxed">{courtData.address}</p>
                </div>
              </div>
            )}

            {/* Amenities */}
            <div className="pt-6 border-t border-hairline">
              <h2 className="text-lg font-semibold text-ink mb-4">Tiện ích đi kèm</h2>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {amenities.map((a, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-surface-soft border border-hairline-soft">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-primary shadow-xs">
                      <a.icon size={18} />
                    </div>
                    <span className="text-xs font-medium text-ink">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Map Location */}
            {courtData.latitude && courtData.longitude ? (
              <div className="pt-6 border-t border-hairline">
                <h2 className="text-lg font-semibold text-ink mb-3">Bản đồ vị trí</h2>
                <CourtMap court={courtData} />
              </div>
            ) : courtData.address ? (
              <div className="pt-6 border-t border-hairline">
                <h2 className="text-lg font-semibold text-ink mb-3">Vị trí trên bản đồ</h2>
                <div className="bg-surface-soft rounded-xl p-6 text-center text-muted border border-hairline text-sm">
                  <p>Bản đồ sẽ hiển thị khi sân có tọa độ GPS chính xác.</p>
                  <p className="text-xs mt-1 text-ink font-medium">Địa chỉ: {courtData.address}</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right - Sticky Reservation Card (Airbnb reservation-card token) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 bg-canvas rounded-xl p-6 border border-hairline shadow-ambient">
              {/* Nightly/Hourly Price */}
              <div className="flex items-baseline justify-between pb-4 mb-4 border-b border-hairline">
                <div>
                  <span className="text-2xl font-bold text-ink">{courtData.price}đ</span>
                  <span className="text-xs text-muted"> / giờ</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-ink">
                  <Star size={13} className="fill-ink text-ink" />
                  <span>4.8</span>
                </div>
              </div>

              {/* Date Picker */}
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                  Ngày đặt sân
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-11 px-3.5 rounded-lg bg-surface-soft border border-hairline text-ink text-sm focus:outline-none focus:border-ink transition-colors"
                />
              </div>

              {/* Time Slots */}
              <p className="text-xs font-semibold uppercase tracking-wider text-ink mb-2">
                Khung giờ trống
              </p>
              {timeSlots.length === 0 ? (
                <p className="text-xs text-muted text-center py-3 bg-surface-soft rounded-lg mb-4">
                  Không có dữ liệu khung giờ cho ngày này.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-5 max-h-48 overflow-y-auto p-1">
                  {timeSlots.map((slot, i) => (
                    <button
                      key={i}
                      disabled={slot.status === 'booked'}
                      className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        slot.status === 'booked'
                          ? 'bg-surface-container text-muted cursor-not-allowed line-through'
                          : 'bg-surface-soft text-ink hover:border-ink border border-hairline hover:bg-surface-container'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}

              {/* Reserve CTA */}
              <button
                onClick={() => navigate('/customer/booking', { state: { courtId: courtData.id } })}
                className="w-full h-12 flex items-center justify-center rounded-lg font-semibold text-sm text-white bg-primary hover:bg-primary-active transition-colors shadow-ambient btn-press cursor-pointer"
              >
                Đặt sân ngay
              </button>
              {canBook && (
                <p className="text-center text-[11px] text-muted mt-3">
                  Miễn phí hoàn hủy trước 24 giờ • Không trừ phí ẩn
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Policies */}
        <section className="mt-12 py-8 px-6 bg-surface-soft border border-hairline rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {policies.map((p, i) => (
              <div key={i} className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-canvas border border-hairline flex items-center justify-center shrink-0 text-primary">
                  <p.icon size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-ink">{p.title}</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
