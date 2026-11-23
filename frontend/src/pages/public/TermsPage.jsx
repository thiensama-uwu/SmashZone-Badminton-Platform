const sections = [
  {
    title: '1. Chấp nhận điều khoản',
    body: 'Khi tạo tài khoản hoặc sử dụng SmashZone, bạn đồng ý tuân thủ các điều khoản sử dụng của nền tảng. Nếu không đồng ý, bạn nên ngừng sử dụng dịch vụ.',
  },
  {
    title: '2. Tài khoản người dùng',
    body: 'Bạn chịu trách nhiệm về thông tin đăng ký, mật khẩu và mọi hoạt động phát sinh từ tài khoản của mình. Vui lòng cung cấp thông tin chính xác và bảo mật tài khoản cẩn thận.',
  },
  {
    title: '3. Đặt sân và thanh toán',
    body: 'Người dùng cần kiểm tra kỹ thông tin sân, ngày giờ đặt và chi phí trước khi xác nhận. Các giao dịch thanh toán, hủy lịch hoặc hoàn tiền được xử lý theo chính sách hiển thị trong hệ thống.',
  },
  {
    title: '4. Hành vi bị cấm',
    body: 'Không sử dụng dịch vụ để gian lận, phá hoại hệ thống, đăng tải nội dung sai lệch hoặc gây ảnh hưởng đến quyền lợi của người dùng và chủ sân khác.',
  },
  {
    title: '5. Thay đổi dịch vụ',
    body: 'SmashZone có thể cập nhật tính năng, giao diện hoặc điều khoản để cải thiện chất lượng dịch vụ. Các thay đổi quan trọng sẽ được thông báo khi cần thiết.',
  },
];

export default function TermsPage() {
  return (
    <div className="py-14 bg-surface-soft min-h-screen text-ink">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="bg-canvas rounded-xl border border-hairline shadow-sm p-6 md:p-10">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">SmashZone</span>
          <h1 className="mt-1.5 text-2xl md:text-3xl font-bold text-ink tracking-tight">Điều khoản dịch vụ</h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Nội dung điều khoản dịch vụ cơ bản áp dụng cho người dùng khi truy cập và sử dụng nền tảng đặt sân SmashZone.
          </p>

          <div className="mt-8 space-y-6 border-t border-hairline-soft pt-6">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
                <p className="mt-1.5 text-xs md:text-sm text-body leading-relaxed">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

