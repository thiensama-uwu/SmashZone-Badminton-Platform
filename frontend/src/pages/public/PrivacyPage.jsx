const sections = [
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

export default function PrivacyPage() {
  return (
    <div className="py-14 bg-surface-soft min-h-screen text-ink">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="bg-canvas rounded-xl border border-hairline shadow-sm p-6 md:p-10">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">SmashZone</span>
          <h1 className="mt-1.5 text-2xl md:text-3xl font-bold text-ink tracking-tight">Chính sách bảo mật</h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Chính sách này mô tả cách SmashZone thu thập, sử dụng và bảo vệ thông tin cá nhân của người dùng khi sử dụng nền tảng.
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

