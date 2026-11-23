import { useState } from 'react';
import { Phone, Mail, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import MapComponent from '../../components/shared/MapComponent';

const iuhLocation = {
  lat: 16.0617,
  lng: 108.2178,
  name: 'Văn phòng SmashZone Đà Nẵng',
  address: '12 Nguyễn Văn Linh, Phường Nam Dương, Quận Hải Châu, Thành phố Đà Nẵng, Việt Nam',
};

const contactCards = [
  { icon: Phone, title: 'Điện thoại', primary: 'Hotline: 1900-1234', secondary: 'Thứ 2 - Chủ nhật, 7:00 - 22:00' },
  { icon: Mail, title: 'Email', primary: 'teo10072004@gmail.com', secondary: 'Phản hồi trong 24h' },
  { icon: MapPin, title: 'Địa chỉ', primary: '12 Nguyễn Văn Linh, Phường Nam Dương, Quận Hải Châu, TP. Đà Nẵng', secondary: 'Mở cửa 6:00 - 23:00' },
];

const faqItems = [
  { q: 'Làm thế nào để đặt sân?', a: 'Bạn chỉ cần chọn sân, chọn ngày và khung giờ phù hợp, sau đó tiến hành thanh toán. Hệ thống sẽ tự động xác nhận và gửi thông báo cho bạn.' },
  { q: 'Chính sách hoàn tiền như thế nào?', a: 'Nếu bạn hủy sân trước 24 giờ so với giờ đặt, bạn sẽ được hoàn 100% tiền cọc. Hủy sau thời gian này sẽ không được hoàn tiền.' },
  { q: 'Tôi có thể đổi lịch không?', a: 'Có! Bạn có thể đổi lịch miễn phí trước giờ chơi 6 tiếng, tùy thuộc vào tình trạng sân trống.' },
  { q: 'Phương thức thanh toán nào được hỗ trợ?', a: 'Chúng tôi hỗ trợ thanh toán qua ví MoMo, ZaloPay, chuyển khoản ngân hàng và thanh toán trực tiếp tại sân.' },
  { q: 'Sân có wifi không?', a: 'Đa số các sân Premium và Tiêu chuẩn đều có WiFi miễn phí. Thông tin chi tiết được ghi rõ trên trang của từng sân.' },
  { q: 'Làm sao để trở thành hội viên?', a: 'Bạn có thể đăng ký gói Hội viên (Cơ bản hoặc VIP) tại trang Bảng giá. Sau khi thanh toán, các ưu đãi sẽ được áp dụng ngay cho lần đặt sân tiếp theo.' },
];

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="bg-canvas text-ink min-h-screen">
      {/* Header */}
      <section className="bg-surface-soft border-b border-hairline py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Liên hệ &amp; Hỗ trợ</span>
          <h1 className="text-2xl sm:text-4xl font-bold text-ink tracking-tight mt-1.5">Chúng tôi luôn sẵn sàng hỗ trợ bạn</h1>
          <p className="mt-2 text-sm text-muted">Mọi thắc mắc về đặt sân, đổi lịch và hoàn tiền sẽ được giải đáp nhanh chóng.</p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contactCards.map((card, i) => (
              <div key={i} className="bg-canvas rounded-xl p-6 border border-hairline shadow-sm hover:shadow-ambient transition-all text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-primary-fixed/40 flex items-center justify-center mb-4 text-primary">
                  <card.icon size={22} />
                </div>
                <h3 className="font-semibold text-sm text-ink">{card.title}</h3>
                <p className="mt-2 text-sm font-semibold text-primary">{card.primary}</p>
                <p className="mt-1 text-xs text-muted">{card.secondary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div>
            <h2 className="text-xl font-bold text-ink mb-4">Văn phòng hỗ trợ</h2>
            <div className="overflow-hidden rounded-xl border border-hairline shadow-sm bg-canvas">
              <MapComponent
                center={iuhLocation}
                markers={[{ ...iuhLocation, popup: iuhLocation.name }]}
                zoom={17}
                height="400px"
              />
              <div className="flex items-start gap-2.5 p-4 text-xs text-body border-t border-hairline bg-surface-soft">
                <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>{iuhLocation.address}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 bg-surface-soft border-t border-hairline mt-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-ink text-center mb-8">Câu hỏi thường gặp</h2>
          <div className="space-y-3">
            {faqItems.map((faq, i) => (
              <div key={i} className="bg-canvas border border-hairline rounded-xl overflow-hidden shadow-xs">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                >
                  <span className="font-medium text-ink text-sm">{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={16} className="text-muted shrink-0" /> : <ChevronDown size={16} className="text-muted shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 border-t border-hairline-soft pt-3">
                    <p className="text-xs sm:text-sm text-body leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

