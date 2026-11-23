import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black gradient-primary bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-2">
          Trang không tồn tại
        </h1>
        <p className="text-on-surface-variant mb-8 leading-relaxed">
          Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-on-surface border border-outline-variant/30 hover:bg-surface-low transition-colors btn-press"
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-90 transition-opacity btn-press"
          >
            <Home size={16} /> Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
