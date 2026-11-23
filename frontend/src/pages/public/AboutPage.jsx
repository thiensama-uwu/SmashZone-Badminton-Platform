import { Link } from 'react-router-dom';
import { 
  Zap, 
  ShieldCheck, 
  HeartHandshake, 
  MapPin, 
  Clock, 
  CalendarCheck, 
  Sparkles, 
  CheckCircle2 
} from 'lucide-react';

const stats = [
  { value: '100%', label: 'Cập nhật theo thời gian thực' },
  { value: '3 Bước', label: 'Đặt chỗ & Thanh toán tức thì' },
  { value: '24/7', label: 'Hệ thống tự động vận hành' },
  { value: '0 Giây', label: 'Thời gian chờ đối soát QR' },
];

const highlights = [
  {
    icon: Zap,
    title: 'Lịch sân trực quan & tức thì',
    desc: 'Tạm biệt việc gọi điện hỏi giờ trống. SmashZone hiển thị khung giờ trống chính xác từng phút, giúp bạn chọn sân trong tích tắc.',
  },
  {
    icon: ShieldCheck,
    title: 'Thanh toán bảo mật chuẩn QR',
    desc: 'Tích hợp chuyển khoản QuickPay QR tự động nhận diện và xác nhận giao dịch ngay lập tức, không qua trung gian rườm rà.',
  },
  {
    icon: MapPin,
    title: 'Hệ thống sân tiện lợi tại Đà Nẵng',
    desc: 'Mạng lưới các sân cầu lông tiêu chuẩn trên khắp các quận Đà Nẵng, trang bị thảm thi đấu chuẩn BWF, ánh sáng chống lóa và tiện ích đầy đủ.',
  },
  {
    icon: HeartHandshake,
    title: 'Minh bạch & Đáng tin cậy',
    desc: 'Bảng giá niêm yết rõ ràng theo từng khung giờ cao điểm và tiêu chuẩn. Chính sách hủy sân và hoàn tiền tự động được cam kết công khai.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Khám phá & Chọn sân',
    desc: 'Tìm kiếm sân gần bạn theo khu vực, xem đánh giá, tiện ích và bản đồ vị trí chi tiết.',
  },
  {
    step: '02',
    title: 'Chọn khung giờ trống',
    desc: 'Bảng lịch trực quan theo ngày cho phép bạn chủ động chọn slot đánh phù hợp chỉ với một cú chạm.',
  },
  {
    step: '03',
    title: 'Quét mã & Nhận sân',
    desc: 'Quét mã QR thanh toán nhanh, vé điện tử và mã check-in được gửi ngay vào tài khoản của bạn.',
  },
];

export default function AboutPage() {
  return (
    <div className="bg-canvas text-ink min-h-screen">
      {/* Hero Section */}
      <section className="bg-surface-soft border-b border-hairline py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200/60 text-primary text-xs font-semibold mb-4">
            <Sparkles size={14} />
            <span>Nền tảng thể thao thông minh</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-ink tracking-tight">
            Đơn giản hóa trải nghiệm thể thao mỗi ngày
          </h1>
          <p className="mt-5 text-base md:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            SmashZone là giải pháp số hóa sân cầu lông hiện đại, kết nối cộng đồng lông thủ với những sân đấu chất lượng cao nhất tại Đà Nẵng một cách liền mạch, nhanh chóng và tin cậy.
          </p>
        </div>
      </section>

      {/* Mission & Story */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] border border-hairline shadow-ambient bg-surface-soft p-2 flex items-center justify-center">
              <img
                src="/about-hero.svg"
                alt="SmashZone Badminton Court Platform"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Sứ mệnh của chúng tôi</span>
              <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight mt-2 mb-6">
                Để bạn chỉ tập trung vào niềm đam mê trên sân cầu
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-body leading-relaxed">
                <p>
                  Trước đây, việc tìm được một sân cầu lông ưng ý đòi hỏi bạn phải tốn hàng giờ gọi điện kiểm tra từng sân, đối mặt với tình trạng trùng lịch, thiếu minh bạch về giá cả hoặc phải chuyển cọc thủ công phức tạp.
                </p>
                <p>
                  <strong className="text-ink font-semibold">SmashZone</strong> được phát triển nhằm tái định nghĩa trải nghiệm này. Chúng tôi ứng dụng công nghệ điện toán phân tán và thanh toán tự động thời gian thực để mang đến một nền tảng minh bạch tuyệt đối: mỗi khung giờ trống hiển thị đều là slot thực tế, đặt giữ chỗ tức thì và hoàn toàn tự động hóa.
                </p>
                <p>
                  Từ người mới chơi đến các câu lạc bộ phong trào, mục tiêu của chúng tôi là xây dựng một phong cách thể thao văn minh, tiện lợi và tràn đầy cảm hứng cho cộng đồng.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-hairline grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-ink">Giữ chỗ thời gian thực, không lo trùng slot</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-ink">Bảo đảm giá minh bạch & hoàn tiền rõ ràng</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Stats */}
      <section className="py-14 bg-surface-soft border-y border-hairline">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary">{s.value}</p>
                <p className="mt-1.5 text-xs sm:text-sm text-muted font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values / Benefits */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Tiện ích vượt trội</span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight mt-2">
              Tại sao hàng ngàn tay vợt tin chọn SmashZone?
            </h2>
            <p className="mt-3 text-sm text-muted">
              Được thiết kế tối ưu cho cả người chơi phong trào và các đội nhóm thi đấu chuyên nghiệp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {highlights.map((h, i) => (
              <div 
                key={i} 
                className="bg-canvas border border-hairline rounded-2xl p-7 shadow-sm hover:shadow-ambient hover:border-neutral-300 transition-all flex gap-5 items-start"
              >
                <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-primary">
                  <h.icon size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">{h.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works (Replaces team section) */}
      <section className="py-16 md:py-20 bg-surface-soft border-t border-hairline">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Quy trình thông minh</span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight mt-2">
              Chỉ 3 bước để sẵn sàng vào sân
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((st, i) => (
              <div key={i} className="bg-canvas border border-hairline rounded-2xl p-6 text-center shadow-sm relative">
                <div className="text-4xl font-extrabold text-primary/20 mb-3 font-mono">{st.step}</div>
                <h3 className="font-bold text-ink text-base mb-2">{st.title}</h3>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="py-16 bg-canvas border-t border-hairline">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-3xl p-8 sm:p-12 text-center shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold">Sẵn sàng bùng nổ cùng SmashZone?</h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-300 max-w-xl mx-auto">
              Hàng chục sân tập tiêu chuẩn tại Đà Nẵng đang mở cửa chào đón bạn và đồng đội. Đặt ngay khung giờ đẹp nhất hôm nay!
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/courts"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-primary hover:bg-primary-active transition-colors shadow-lg"
              >
                Khám phá sân ngay
              </Link>
              <Link
                to="/contact"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-semibold text-sm text-white bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
              >
                Liên hệ hợp tác sân
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
