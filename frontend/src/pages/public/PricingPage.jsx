import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Crown, ChevronDown, ChevronUp } from 'lucide-react';

const courtPlans = [
  {
    name: 'Sân Xi Măng',
    tag: 'Tiết kiệm',
    price: '80.000',
    features: ['Mặt sân xi măng', 'Đèn chiếu sáng', 'Khu vực mở'],
    highlighted: false,
  },
  {
    name: 'Sân Nhựa',
    tag: 'Tiêu chuẩn',
    price: '120.000',
    badge: 'Phổ biến nhất',
    features: ['Mặt sân nhựa PVC', 'Đèn chiếu sáng tốt', 'Quạt thông gió', 'WiFi miễn phí'],
    highlighted: true,
  },
  {
    name: 'Sân Gỗ',
    tag: 'Premium',
    price: '150.000',
    features: ['Mặt sân gỗ cao cấp', 'Đèn LED chuyên nghiệp', 'Máy lạnh', 'WiFi miễn phí'],
    highlighted: false,
  },
];

const timeSlots = [
  { time: 'Sáng sớm (5:00 - 8:00)', modifier: 'Giảm 20%', type: 'discount' },
  { time: 'Giờ hành chính (8:00 - 17:00)', modifier: 'Giá chuẩn', type: 'standard' },
  { time: 'Giờ cao điểm (17:00 - 21:00)', modifier: '+30%', type: 'peak' },
  { time: 'Đêm muộn (21:00 - 23:00)', modifier: 'Giá chuẩn', type: 'standard' },
];

const memberships = [
  {
    name: 'Gói Cơ bản',
    price: '199.000',
    period: '/tháng',
    benefits: ['Giảm 10% mọi lượt đặt', 'Ưu tiên đặt sân', 'Hỗ trợ 24/7'],
    highlighted: false,
  },
  {
    name: 'Gói VIP',
    price: '499.000',
    period: '/tháng',
    icon: Crown,
    benefits: ['Giảm 25% mọi lượt đặt', 'Đặt sân trước 7 ngày', 'Phòng VIP miễn phí', 'Hỗ trợ riêng'],
    highlighted: true,
  },
];

const faqs = [
  { q: 'Giá có bao gồm vợt và cầu không?', a: 'Giá sân chưa bao gồm dụng cụ. Bạn có thể thuê vợt và mua cầu tại quầy với giá ưu đãi.' },
  { q: 'Có ưu đãi cho đặt sân dài hạn không?', a: 'Có! Khi đăng ký gói Hội viên, bạn sẽ được giảm giá từ 10-25% cho mỗi lượt đặt.' },
  { q: 'Giá giờ cao điểm áp dụng cho ngày nào?', a: 'Giá giờ cao điểm áp dụng cho tất cả các ngày trong tuần, từ 17:00 đến 21:00.' },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <>
      {/* Header */}
      <section className="bg-surface-low py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight">Bảng giá</h1>
          <p className="mt-3 text-on-surface-variant max-w-md mx-auto">
            Minh bạch, cạnh tranh, phù hợp mọi nhu cầu.
          </p>
        </div>
      </section>

      {/* Court Type Pricing */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courtPlans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-6 transition-lift ${plan.highlighted
                    ? 'bg-surface-lowest border-2 border-primary-container shadow-lg'
                    : 'bg-surface-lowest shadow-ambient'
                  }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white gradient-primary">
                    {plan.badge}
                  </span>
                )}
                <p className="text-xs font-bold uppercase tracking-widest text-primary-container">{plan.tag}</p>
                <h3 className="text-xl font-bold text-on-surface mt-2">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-primary">{plan.price}đ</span>
                  <span className="text-sm text-on-surface-variant"> / giờ</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-on-surface-variant">
                      <Check size={16} className="text-primary-container shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/courts"
                  className={`block mt-6 py-3 rounded-xl text-center font-semibold transition-colors ${plan.highlighted
                      ? 'text-white gradient-primary hover:opacity-90'
                      : 'text-primary border border-outline-variant/40 hover:bg-primary-fixed/10'
                    }`}
                >
                  Đặt sân
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Time-based Pricing */}
      <section className="py-16 bg-surface-low">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-on-surface text-center mb-8">Giá theo khung giờ</h2>
          <div className="max-w-2xl mx-auto bg-surface-lowest rounded-2xl overflow-hidden shadow-ambient">
            {timeSlots.map((slot, i) => (
              <div key={i} className={`flex items-center justify-between px-6 py-4 ${i !== timeSlots.length - 1 ? 'border-b border-outline-variant/20' : ''}`}>
                <span className="text-sm text-on-surface font-medium">{slot.time}</span>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${slot.type === 'discount' ? 'bg-primary-fixed/20 text-primary' :
                    slot.type === 'peak' ? 'bg-amber-50 text-amber-600' :
                      'bg-surface-high text-on-surface-variant'
                  }`}>
                  {slot.modifier}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-on-surface text-center mb-8">Gói hội viên</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {memberships.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 ${m.highlighted
                    ? 'gradient-primary text-white'
                    : 'bg-surface-lowest shadow-ambient'
                  }`}
              >
                {m.icon && <m.icon size={28} className={m.highlighted ? 'text-primary-fixed' : 'text-primary'} />}
                <h3 className={`text-xl font-bold mt-3 ${m.highlighted ? 'text-white' : 'text-on-surface'}`}>
                  {m.name}
                </h3>
                <div className="mt-2">
                  <span className={`text-3xl font-bold ${m.highlighted ? 'text-white' : 'text-primary'}`}>{m.price}đ</span>
                  <span className={`text-sm ${m.highlighted ? 'text-white/70' : 'text-on-surface-variant'}`}>{m.period}</span>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {m.benefits.map((b, j) => (
                    <li key={j} className={`flex items-center gap-2 text-sm ${m.highlighted ? 'text-white/90' : 'text-on-surface-variant'}`}>
                      <Check size={16} className={`shrink-0 ${m.highlighted ? 'text-primary-fixed' : 'text-primary-container'}`} />
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full mt-6 py-3 rounded-xl font-semibold transition-colors ${m.highlighted
                      ? 'bg-white text-primary hover:bg-primary-fixed/20 hover:text-white'
                      : 'border border-outline-variant/40 text-primary hover:bg-primary-fixed/10'
                    }`}
                >
                  {m.highlighted ? 'Đăng ký VIP' : 'Đăng ký'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-surface-low">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-on-surface text-center mb-8">Có thắc mắc về giá?</h2>
          <div className="max-w-2xl mx-auto space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-surface-lowest rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-medium text-on-surface text-sm">{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={18} className="text-outline shrink-0" /> : <ChevronDown size={18} className="text-outline shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-on-surface-variant leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link to="/contact" className="text-sm text-primary font-medium hover:underline">
              Xem tất cả câu hỏi →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
