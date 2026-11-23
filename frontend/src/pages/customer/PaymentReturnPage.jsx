import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

/** Đồng bộ với PaymentPage — lưu paymentId/bookingId trước khi sang cổng SePay. */
const SEPAY_PENDING_KEY = 'cnm_sepay_pending_pay';

export default function PaymentReturnPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const result = searchParams.get('result');
  const bookingId = searchParams.get('bookingId');

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleReturn = async () => {
      // Lấy paymentId từ sessionStorage để polling
      const pending = sessionStorage.getItem(SEPAY_PENDING_KEY);
      if (!pending) {
        setStatus('error');
        setMessage('Không tìm thấy thông tin thanh toán. Vui lòng thử lại.');
        setTimeout(() => navigate('/customer/booking'), 3000);
        return;
      }

      const { paymentId } = JSON.parse(pending);

      // Polling kiểm tra trạng thái thanh toán
      const maxAttempts = 20;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const response = await fetch(`/api/payments/${paymentId}`);
          if (!response.ok) throw new Error('Failed to fetch payment status');
          const payment = await response.json();

          if (payment.status === 'COMPLETED') {
            setStatus('success');
            setMessage('Thanh toán thành công! Đang chuyển đến lịch sử đặt sân...');
            sessionStorage.removeItem(SEPAY_PENDING_KEY);
            setTimeout(() => navigate('/customer/history'), 2000);
            return;
          }

          if (payment.status === 'FAILED') {
            setStatus('error');
            setMessage('Thanh toán thất bại. Vui lòng thử lại.');
            sessionStorage.removeItem(SEPAY_PENDING_KEY);
            setTimeout(() => navigate('/customer/booking'), 3000);
            return;
          }

          // Chờ 1.5s trước khi kiểm tra lại
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.error('Polling error:', error);
        }
      }

      // Hết thời gian chờ
      setStatus('warning');
      setMessage('Không thể xác nhận trạng thái thanh toán. Vui lòng kiểm tra lịch sử đặt sân.');
      sessionStorage.removeItem(SEPAY_PENDING_KEY);
      setTimeout(() => navigate('/customer/history'), 3000);
    };

    handleReturn();
  }, [result, bookingId, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-lowest">
        <div className="text-center space-y-4">
          <Loader2 size={48} className="animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-semibold text-on-surface">Đang xác nhận thanh toán...</h2>
          <p className="text-sm text-on-surface-variant">Vui lòng không đóng trang này</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-lowest p-6">
      <div className="max-w-md w-full bg-surface rounded-2xl p-8 shadow-ambient space-y-6">
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-on-surface mb-2">Thanh toán thành công!</h2>
              <p className="text-sm text-on-surface-variant">{message}</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle size={32} className="text-red-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-on-surface mb-2">Thanh toán thất bại</h2>
              <p className="text-sm text-on-surface-variant">{message}</p>
            </div>
          </div>
        )}

        {status === 'warning' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle size={32} className="text-amber-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-on-surface mb-2">Không thể xác nhận</h2>
              <p className="text-sm text-on-surface-variant">{message}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
