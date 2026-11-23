const termsSections = [
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

const privacySections = [
  {
    title: '1. Thông tin chúng tôi thu thập',
    body: 'SmashZone có thể thu thập các thông tin cần thiết như họ tên, email, số điện thoại, lịch đặt sân và thông tin giao dịch để cung cấp dịch vụ.',
  },
  {
    title: '2. Mục đích sử dụng thông tin',
    body: 'Thông tin được dùng để tạo tài khoản, xác nhận đặt sân, hỗ trợ khách hàng, gửi thông báo liên quan đến dịch vụ và cải thiện trải nghiệm sử dụng.',
  },
  {
    title: '3. Bảo mật dữ liệu',
    body: 'Chúng tôi áp dụng các biện pháp kỹ thuật hợp lý để bảo vệ dữ liệu người dùng khỏi truy cập trái phép, mất mát hoặc sử dụng sai mục đích.',
  },
  {
    title: '4. Chia sẻ thông tin',
    body: 'SmashZone không bán thông tin cá nhân của người dùng. Thông tin chỉ được chia sẻ khi cần thiết để xử lý đặt sân, thanh toán, hỗ trợ kỹ thuật hoặc theo yêu cầu pháp luật.',
  },
  {
    title: '5. Quyền của người dùng',
    body: 'Bạn có thể yêu cầu cập nhật, chỉnh sửa hoặc hỗ trợ liên quan đến thông tin cá nhân của mình thông qua các kênh liên hệ của SmashZone.',
  },
];

function PolicySection({ id, title, description, sections }) {
  return (
    <section id={id} className="bg-canvas rounded-xl border border-hairline shadow-sm p-6 md:p-8">
      <h2 className="text-xl font-bold text-ink tracking-tight">{title}</h2>
      <p className="mt-2 text-xs md:text-sm text-muted leading-relaxed">{description}</p>

      <div className="mt-6 space-y-5 border-t border-hairline-soft pt-5">
        {sections.map((section) => (
          <section key={section.title}>
            <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
            <p className="mt-1.5 text-xs md:text-sm text-body leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function PoliciesPage() {
  return (
    <div className="py-14 bg-surface-soft min-h-screen text-ink">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Quy định &amp; Minh bạch</span>
          <h1 className="text-2xl sm:text-4xl font-bold text-ink tracking-tight mt-1.5">Chính sách nền tảng</h1>
          <p className="mt-2 text-sm text-muted">
            Điều khoản dịch vụ và chính sách bảo mật thông tin khi sử dụng SmashZone.
          </p>
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <PolicySection
            id="terms"
            title="Điều khoản dịch vụ"
            description="Quy định áp dụng cho tất cả người dùng khi tạo tài khoản, tìm kiếm và đặt sân qua nền tảng."
            sections={termsSections}
          />
          <PolicySection
            id="privacy"
            title="Chính sách bảo mật"
            description="Cách thức chúng tôi bảo vệ, lưu trữ và cam kết bảo mật dữ liệu cá nhân của người dùng."
            sections={privacySections}
          />
        </div>
      </div>
    </div>
  );
}

