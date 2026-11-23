import { useState, useEffect, useRef, useTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi } from '../../api/bookings';
import { paymentsApi } from '../../api/index';
import { AlertCircle, CheckCircle, Clock, QrCode } from 'lucide-react';

function formatPrice(n) { return n?.toLocaleString('vi-VN') + 'đ'; }

// YC5: Hold expiry countdown hook
function useCountdown(expiry) {
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiry) return;
    const target = new Date(expiry).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setRemaining('00:00');
        setExpired(true);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiry]);

  return { remaining, expired };
}

export default function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { bookingId, totalAmount } = location.state || {};

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [paymentResult, setPaymentResult] = useState(null);
  const [polling, setPolling] = useState(false);
  const hasRedirected = useRef(false);
  const [paymentData, setPaymentData] = useState(null);
  const pollingIntervalRef = useRef(null);
  const hasNotifiedFailure = useRef(false);

  useEffect(() => {
    if (!bookingId) {
      navigate('/customer/booking');
      return;
    }
    bookingsApi.get(bookingId)
      .then(setBooking)
      .catch(() => setError('Không tìm thấy thông tin đặt sân.'))
      .finally(() => setLoading(false));
  }, [bookingId, navigate]);

  // YC5: countdown for hold expiry
  const { remaining, expired } = useCountdown(booking?.holdExpiredAt);

  // YC5: Auto-redirect when hold expires
  useEffect(() => {
    if (expired && !success && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate('/customer/booking', { replace: true });
    }
  }, [expired, success, navigate]);

  const startPolling = (paymentId) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    hasNotifiedFailure.current = false;

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const payment = await paymentsApi.get(paymentId);

        if (payment.status === 'COMPLETED') {
          clearInterval(pollingIntervalRef.current);
          setSuccess(true);
          setPolling(false);
          setTimeout(() => navigate('/customer/history'), 2500);
        } else if (payment.status === 'FAILED' && !hasNotifiedFailure.current) {
          clearInterval(pollingIntervalRef.current);
          hasNotifiedFailure.current = true;
          setError('Thanh toán thất bại hoặc hết hạn.');
          setPolling(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Continue polling on error
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 10 minutes (600 seconds)
    setTimeout(() => {
      if (pollingIntervalRef.current && !hasNotifiedFailure.current) {
        clearInterval(pollingIntervalRef.current);
        hasNotifiedFailure.current = true;
        setError('Hết thời gian chờ thanh toán (10 phút).');
        setPolling(false);
      }
    }, 10 * 60 * 1000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handlePay = () => {
    setError('');

    if (!bookingId) {
      setError('Không tìm thấy thông tin đặt sân.');
      return;
    }

    const amount = booking?.totalAmount || totalAmount;
    if (!amount) {
      setError('Không tìm thấy số tiền thanh toán.');
      return;
    }

    startTransition(async () => {
      try {
        const idempotencyKey = `pay-${bookingId}-${Date.now()}`;
        const payment = await paymentsApi.create({
          bookingId,
          totalAmount: amount,
        }, idempotencyKey);

        setPaymentData(payment);
        setPolling(true);
        startPolling(payment.id);
      } catch (err) {
        setError(err.message || 'Không thể tạo thanh toán. Vui lòng thử lại.');
      }
    });
  };

  if (loading) return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-low animate-pulse" />)}
    </div>
  );

  // Status text Vietnamese map (YC4)
  const statusVN = {
    PENDING_HOLD: 'Đang giữ chỗ',
    PENDING_PAYMENT: 'Chờ thanh toán',
    CONFIRMED: 'Đã xác nhận',
    CANCELLED: 'Đã hủy',
    CHECKED_IN: 'Đã check-in',
    COMPLETED: 'Hoàn thành',
    EXPIRED: 'Hết hạn',
    REFUND_PENDING: 'Chờ hoàn tiền',
    REFUNDED: 'Đã hoàn tiền',
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-on-surface mb-6">Thanh toán</h1>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700">
          <CheckCircle size={20} />
          <div>
            <p className="font-semibold">Thanh toán thành công!</p>
            <p className="text-sm">Đang chuyển đến lịch sử đặt sân...</p>
          </div>
        </div>
      )}

      {booking && (
        <div className="bg-surface-lowest rounded-2xl p-6 shadow-ambient space-y-4">
          <h2 className="font-semibold text-on-surface">Chi tiết đặt sân</h2>

            <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Mã booking</span>
              <span className="font-mono text-on-surface">{booking.bookingCode}</span>
            </div>


            <div className="flex justify-between">
              <span className="text-on-surface-variant">Ngày</span>
              <span className="text-on-surface">{booking.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Giờ</span>
              <span className="text-on-surface text-right">
                {(booking.reservations?.length ? booking.reservations : [{ startTime: booking.startTime, endTime: booking.endTime }])
                  .map((slot) => `${slot.startTime} - ${slot.endTime}`)
                  .join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Trạng thái</span>
              <span className="text-on-surface">{statusVN[booking.status] || booking.status}</span>
            </div>
          </div>

          <div className="border-t border-outline-variant/20 pt-4 flex justify-between font-bold text-base">
            <span>Tổng tiền</span>
            <span className="text-primary">{formatPrice(totalAmount || booking.totalAmount)}</span>
          </div>

          {/* Payment Method */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-fixed/10 border-2 border-primary">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <QrCode size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Chuyển khoản QR</p>
              <p className="text-xs text-on-surface-variant">Quét mã QR chuyển khoản ngân hàng</p>
            </div>
          </div>

          {/* QR Code Display */}
          {paymentData && (
            <div className="space-y-4 border-t border-outline-variant/20 pt-4">
              {/* QR Code Image */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-md">
                  {(() => {
                    const qrUrl = paymentData.qrDataUrl 
                      || (paymentData.bankInfo 
                          ? `https://qr.sepay.vn/img?bank=${paymentData.bankInfo.bankCode || 'TPBANK'}&acc=${paymentData.bankInfo.accountNumber}&amount=${paymentData.bankInfo.amount || paymentData.amount}&des=${paymentData.transferContent || ''}&template=compact`
                          : null);
                    return qrUrl ? (
                      <img 
                        src={qrUrl} 
                        alt="QR thanh toán" 
                        className="w-64 h-64"
                      />
                    ) : (
                      <div className="w-64 h-64 flex items-center justify-center bg-surface-low rounded-lg">
                        <p className="text-sm text-on-surface-variant text-center px-4">
                          Không thể tải QR code. Vui lòng sử dụng thông tin chuyển khoản bên dưới.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Manual Transfer Info */}
              <div className="bg-surface-low rounded-xl p-4 space-y-2 text-sm">
                <h4 className="font-semibold text-on-surface mb-3">Thông tin chuyển khoản</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Ngân hàng:</span>
                    <span className="font-medium text-on-surface">{paymentData.bankInfo?.bankCode || 'Chưa cấu hình'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Số tài khoản:</span>
                    <span className="font-mono font-medium text-on-surface">{paymentData.bankInfo?.accountNumber || 'Chưa cấu hình'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Chủ tài khoản:</span>
                    <span className="font-medium text-on-surface">{paymentData.bankInfo?.accountName || 'Chưa cấu hình'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Số tiền:</span>
                    <span className="font-bold text-primary">{formatPrice(paymentData.amount)}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-2 border-t border-outline-variant/20">
                    <span className="text-on-surface-variant">Nội dung chuyển khoản:</span>
                    <div className="flex items-center justify-between bg-error-container/10 rounded px-3 py-2">
                      <span className="font-mono font-bold text-error text-base">{paymentData.transferContent}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentData.transferContent);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Important Note */}
              <div className="text-xs text-on-surface-variant bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="font-semibold text-amber-700 mb-1">⚠️ Lưu ý quan trọng:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-900">
                  <li>Chuyển khoản <strong>đúng số tiền</strong> và <strong>đúng nội dung</strong></li>
                  <li>Hệ thống tự động xác nhận thanh toán trong vài giây</li>
                  <li>Không đóng trang này cho đến khi thanh toán thành công</li>
                </ul>
              </div>

              {/* Polling Status */}
              {polling && (
                <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span>Đang chờ xác nhận thanh toán...</span>
                </div>
              )}
            </div>
          )}

          {/* YC5: Hold expiry countdown */}
          {booking.holdExpiredAt && !success && (
            <div className={`flex items-center gap-2 text-xs p-2.5 rounded-lg ${expired ? 'bg-red-50 text-error' : 'bg-amber-50 text-amber-700'}`}>
              <Clock size={14} />
              <span>
                {expired
                  ? 'Đã hết thời gian giữ chỗ! Đang chuyển hướng...'
                  : `Thời gian giữ chỗ còn: ${remaining}`}
              </span>
            </div>
          )}

          {!paymentResult && !paymentData && (
            <button
              onClick={handlePay}
              disabled={isPending || success || expired}
              className="w-full py-3 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xử lý...</>
              ) : (
                <><QrCode size={16} /> Xác nhận thanh toán</>  
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
