import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, CalendarDays, CreditCard, Star, ArrowRight, MapPin, Award, Sparkles, Heart } from 'lucide-react';
import { courtsApi } from '../../api/courts';

const BRANCH_LOCATION_MAP = {
  branch_hcm_1: 'Đà Nẵng',
  branch_dn_1: 'Đà Nẵng',
  branch_hn_1: 'Hà Nội',
};

const DEFAULT_IMAGE = '/courts/default-court.svg';

const steps = [
  { icon: Search, title: 'Chọn sân', desc: 'Tìm kiếm sân theo khu vực, bảng giá và tiện ích phù hợp.' },
  { icon: CalendarDays, title: 'Chọn giờ', desc: 'Xem lịch trống theo thời gian thực và chọn khung giờ yêu thích.' },
  { icon: CreditCard, title: 'Thanh toán & Nhận sân', desc: 'Thanh toán bảo mật tức thì, xác nhận tự động qua hệ thống.' },
];

const testimonials = [
  { name: 'Nguyễn Văn A', role: 'Người chơi thường xuyên', quote: 'Đặt sân nhanh chóng, tiện lợi. Tôi rất hài lòng với dịch vụ!', avatar: 'A' },
  { name: 'Trần Thị B', role: 'HLV cầu lông', quote: 'Giao diện dễ sử dụng, lịch sân rõ ràng. Tiết kiệm nhiều thời gian cho tôi.', avatar: 'B' },
  { name: 'Lê Hoàng C', role: 'CLB Cầu lông Sông Hàn Đà Nẵng', quote: 'Đặt sân cho cả đội chưa bao giờ dễ dàng đến thế! Highly recommend.', avatar: 'C' },
];

export default function HomePage() {
  const [featuredCourts, setFeaturedCourts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    courtsApi.featured()
      .then((data) => {
        const courts = Array.isArray(data) ? data : (data?.items || []);
        setFeaturedCourts(courts.slice(0, 3));
      })
      .catch(() => setFeaturedCourts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-canvas text-ink">
      {/* Hero Section - Airbnb clean canvas & photography */}
      <section className="relative px-4 sm:px-6 lg:px-10 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="relative rounded-3xl overflow-hidden min-h-[460px] md:min-h-[500px] flex items-center bg-ink">
            {/* Vector Artwork Background */}
            <img
              src="/assets/hero-banner.svg"
              alt="SmashZone Banner"
              className="absolute inset-0 w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

            <div className="relative z-10 p-8 sm:p-12 md:p-16 max-w-2xl text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-5">
                <Sparkles size={14} className="text-primary-dim" /> Trải nghiệm thể thao chuẩn mực
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white">
                Đặt sân cầu lông<br />
                <span className="text-primary-dim">nhanh chóng &amp; dễ dàng</span>
              </h1>
              <p className="mt-4 text-base sm:text-lg text-white/85 leading-relaxed font-normal">
                Khám phá hệ thống sân tiêu chuẩn toàn quốc. Kiểm tra lịch trống real-time và đặt chỗ tức thì.
              </p>

              {/* Pill Search Button / CTA */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/courts"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-active transition-colors shadow-ambient btn-press"
                >
                  <Search size={16} />
                  <span>Khám phá danh sách sân</span>
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg text-sm font-medium text-white bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors"
                >
                  Tìm hiểu thêm
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courts - Photo-First Airbnb Cards */}
      <section className="px-4 sm:px-6 lg:px-10 py-12 md:py-16 border-t border-hairline-soft">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-soft border border-hairline text-xs font-semibold text-ink mb-3">
                <Award size={14} className="text-primary" />
                Được đặt nhiều nhất
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
                Sân nổi bật được yêu thích
              </h2>
              <p className="mt-1 text-sm text-muted">
                Những sân cầu lông có chất lượng mặt sân và dịch vụ được đánh giá cao nhất.
              </p>
            </div>
            <Link
              to="/courts"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              Xem tất cả sân <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-hairline bg-canvas">
                  <div className="aspect-[4/3] bg-surface-soft animate-pulse" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-4 bg-surface-soft rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-surface-soft rounded w-1/2 animate-pulse" />
                    <div className="h-4 bg-surface-soft rounded w-1/3 animate-pulse mt-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredCourts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredCourts.map((court, idx) => {
                const price = court.priceSchedules?.[0]?.price?.toLocaleString('vi-VN') || '—';
                const location = BRANCH_LOCATION_MAP[court.branchId] || 'Đà Nẵng';
                return (
                  <Link
                    key={court.id}
                    to={`/courts/${court.slug || court.id}`}
                    className="group flex flex-col bg-canvas rounded-xl overflow-hidden border border-hairline hover:shadow-ambient transition-all"
                  >
                    {/* Photo plate with guest favorite badge & heart */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-surface-soft">
                      <img
                        src={court.imageUrl || DEFAULT_IMAGE}
                        alt={court.name}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      />
                      {/* Guest favorite badge */}
                      <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-white text-ink shadow-sm border border-black/5">
                        {idx === 0 ? 'Yêu thích hàng đầu' : location}
                      </span>
                      {/* Heart save icon placeholder */}
                      <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-ink transition-colors shadow-sm">
                        <Heart size={16} className="text-ink" />
                      </div>
                    </div>

                    {/* Metadata lines */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-ink text-base line-clamp-1 group-hover:text-primary transition-colors">
                            {court.name}
                          </h3>
                          <div className="flex items-center gap-1 shrink-0 text-sm font-semibold text-ink">
                            <Star size={14} className="fill-ink text-ink" />
                            <span>4.8</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted">
                          <MapPin size={13} className="shrink-0" />
                          <span className="truncate">{location}</span>
                          {court.bookingCount > 0 && (
                            <span>• {court.bookingCount} lượt đặt</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-hairline-soft flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-ink">
                            Từ {price}đ
                          </span>
                          <span className="text-xs text-muted"> / giờ</span>
                        </div>
                        <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                          Chi tiết <ArrowRight size={13} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted py-8">Chưa có dữ liệu sân nổi bật.</p>
          )}
        </div>
      </section>

      {/* 3 Steps - Airbnb Clean Layout */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 md:py-18 bg-surface-soft border-t border-hairline">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Quy trình đặt sân đơn giản
            </h2>
            <p className="mt-2 text-sm text-muted">
              Hoàn tất đặt sân và nhận mã xác nhận chỉ trong 3 bước.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div
                key={i}
                className="bg-canvas rounded-xl p-6 border border-hairline text-center hover:shadow-ambient transition-all"
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-primary-fixed/40 flex items-center justify-center text-primary mb-4">
                  <step.icon size={22} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Bước {i + 1}
                </span>
                <h3 className="text-base font-semibold text-ink mt-1.5">{step.title}</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 sm:px-6 lg:px-10 py-14 md:py-18 border-t border-hairline">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Đánh giá từ cộng đồng
            </h2>
            <p className="mt-2 text-sm text-muted">
              Sự hài lòng của người chơi là ưu tiên hàng đầu của chúng tôi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-canvas rounded-xl p-6 border border-hairline flex flex-col justify-between hover:shadow-ambient transition-all"
              >
                <p className="text-sm text-body italic leading-relaxed">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-hairline-soft">
                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-ink">{t.name}</p>
                    <p className="text-xs text-muted">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Strip */}
      <section className="px-4 sm:px-6 lg:px-10 py-12 md:py-16 bg-surface-soft border-t border-hairline">
        <div className="mx-auto max-w-4xl text-center bg-canvas border border-hairline rounded-2xl p-8 sm:p-12 shadow-ambient">
          <h2 className="text-2xl sm:text-3xl font-bold text-ink">
            Sẵn sàng cho trận cầu tiếp theo?
          </h2>
          <p className="mt-3 text-sm text-muted max-w-lg mx-auto">
            Hàng trăm sân cầu lông chất lượng đang chờ đón bạn. Đặt ngay hôm nay để nhận khung giờ ưng ý nhất!
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/courts"
              className="px-8 py-3 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-active transition-colors shadow-ambient btn-press"
            >
              Đặt sân ngay bây giờ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

