import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Globe } from 'lucide-react';

const quickLinks = [
  { to: '/', label: 'Trang chủ' },
  { to: '/courts', label: 'Danh sách sân' },
  { to: '/about', label: 'Giới thiệu' },
  { to: '/contact', label: 'Liên hệ' },
];

const policyLinks = [
  { to: '/policies', label: 'Chính sách đặt sân' },
  { to: '/terms', label: 'Điều khoản dịch vụ' },
  { to: '/privacy', label: 'Chính sách bảo mật' },
];

export default function Footer() {
  return (
    <footer className="bg-canvas border-t border-hairline text-ink mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="SmashZone Logo" className="h-7 w-7 object-contain" />
              </div>
              <span className="text-xl font-bold text-primary tracking-tight">
                Smash<span className="text-ink">Zone</span>
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Nền tảng đặt sân cầu lông trực tuyến hàng đầu. Tìm kiếm sân, đặt lịch nhanh chóng, tiện lợi.
            </p>
            <p className="text-xs text-muted leading-relaxed">
              <span className="font-semibold text-ink">Đội ngũ sáng lập:</span><br />
              Trần Chí Tiến &amp; Nguyễn Tuấn Anh
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-ink mb-4">
              Khám phá
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted hover:text-ink hover:underline transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Policy Links */}
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-ink mb-4">
              Hỗ trợ &amp; Điều khoản
            </h4>
            <ul className="space-y-2.5">
              {policyLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted hover:text-ink hover:underline transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-ink mb-4">
              Liên hệ
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-sm text-muted">
                <Phone size={16} className="mt-0.5 shrink-0 text-ink" />
                <span>1900-1234</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-muted">
                <Mail size={16} className="mt-0.5 shrink-0 text-ink" />
                <span>teo10072004@gmail.com</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-muted">
                <MapPin size={16} className="mt-0.5 shrink-0 text-ink" />
                <span>12 Nguyễn Văn Linh, Phường Nam Dương, Quận Hải Châu, TP. Đà Nẵng</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Legal Band */}
      <div className="border-t border-hairline bg-surface-soft py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <p>© {new Date().getFullYear()} SmashZone, Inc. Tất cả quyền được bảo lưu.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-ink font-medium">
              <Globe size={14} /> Tiếng Việt (VN)
            </span>
            <span>•</span>
            <span className="text-ink font-medium">VND (đ)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}


