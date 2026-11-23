import { useState } from 'react';
import { Download, X } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, onExport }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  if (!isOpen) return null;

  const handleExport = () => {
    if (!fromDate || !toDate) {
      alert('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc');
      return;
    }
    onExport(fromDate, toDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-surface-lowest rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
          <h3 className="text-lg font-bold text-on-surface">Xuất dữ liệu doanh thu</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-low transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-low border border-outline-variant/20 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-low border border-outline-variant/20 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="bg-surface-low p-4 rounded-xl">
            <p className="text-xs text-on-surface-variant">
              <strong>Lưu ý:</strong> File sẽ được xuất dưới định dạng XLSX với 3 sheet: Tổng quan, Tiền vào, Tiền ra.
            </p>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-outline-variant/20">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-low transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleExport}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Xuất file
          </button>
        </div>
      </div>
    </div>
  );
}
