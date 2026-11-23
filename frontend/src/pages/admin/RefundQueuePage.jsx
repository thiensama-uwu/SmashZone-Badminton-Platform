import { useCallback, useState, useTransition } from 'react';
import { CheckCircle, Clipboard, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { paymentsApi } from '../../api/index';
import AsyncState from '../../components/AsyncState';
import { clearCache, useApi } from '../../hooks/useApi';
import { useToast } from '../../contexts/useToast';

const tabs = [
  { key: 'needs_transfer', label: 'Cần chuyển khoản' },
  { key: 'waiting_webhook', label: 'Chờ đối soát' },
  { key: 'needs_review', label: 'Cần kiểm tra' },
  { key: 'succeeded', label: 'Đã hoàn' },
  { key: 'failed', label: 'Thất bại' },
];

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function statusLabel(refund) {
  if (refund.status === 'SUCCEEDED') return 'Đã hoàn';
  if (refund.status === 'FAILED') return 'Thất bại';
  if (refund.lastMismatchReason) return `Cần kiểm tra: ${refund.lastMismatchReason}`;
  if (refund.manualTransferMarkedAt) return 'Chờ SePay đối soát';
  return 'Cần chuyển khoản';
}

export default function RefundQueuePage() {
  const toast = useToast();
  const [tab, setTab] = useState('needs_transfer');
  const [isPending, startTransition] = useTransition();
  const fetcher = useCallback(() => paymentsApi.listRefunds({ tab }), [tab]);
  const { data, loading, error, refresh } = useApi(`admin:refunds:${tab}`, fetcher, {
    ttlMs: 15_000,
    onError: (err) => toast.error(err.message || 'Không thể tải danh sách hoàn tiền.'),
  });
  const refunds = data?.items || [];

  const refreshList = () => {
    clearCache('admin:refunds');
    refresh();
  };

  const copy = async (value) => {
    await navigator.clipboard?.writeText(value || '');
    toast.success('Đã sao chép.');
  };

  const runAction = (action) => {
    startTransition(async () => {
      try {
        await action();
        refreshList();
      } catch (err) {
        toast.error(err.message || 'Thao tác thất bại.');
      }
    });
  };

  const markTransferred = (refund) => runAction(async () => {
    await paymentsApi.markRefundTransferred(refund.id);
    toast.success('Đã ghi nhận chờ SePay đối soát.');
  });

  const manualComplete = (refund) => runAction(async () => {
    const providerTransactionId = window.prompt('Mã giao dịch/chứng từ');
    const manualProofNote = window.prompt('Ghi chú chứng từ');
    if (!providerTransactionId && !manualProofNote) return;
    await paymentsApi.manualCompleteRefund(refund.id, { providerTransactionId, manualProofNote });
    toast.success('Đã xác nhận hoàn tiền thủ công.');
  });

  const failRefund = (refund) => runAction(async () => {
    const failureReason = window.prompt('Lý do đánh dấu thất bại');
    if (!failureReason) return;
    await paymentsApi.failRefund(refund.id, { failureReason });
    toast.success('Đã đánh dấu refund thất bại.');
  });

  const retryRefund = (refund) => runAction(async () => {
    const refundBankName = window.prompt('Ngân hàng nhận hoàn tiền');
    const refundAccountNumber = window.prompt('Số tài khoản nhận hoàn tiền');
    const refundAccountName = window.prompt('Tên chủ tài khoản');
    if (!refundBankName || !refundAccountNumber || !refundAccountName) return;
    await paymentsApi.retryRefund(refund.id, { refundBankName, refundAccountNumber, refundAccountName });
    toast.success('Đã tạo yêu cầu hoàn tiền mới.');
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-on-surface">Đối soát hoàn tiền</h1>
        <button onClick={refreshList} className="p-2 rounded-lg border border-outline-variant/30 hover:bg-surface-low transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)}
            className={`px-3 h-9 rounded-lg text-sm font-medium transition-colors ${tab === item.key ? 'bg-primary text-white' : 'bg-white text-on-surface-variant hover:bg-surface-low'}`}>
            {item.label}
          </button>
        ))}
      </div>

      <AsyncState loading={loading} error={error} data={refunds} emptyText="Không có yêu cầu hoàn tiền nào.">
        <div className="overflow-x-auto bg-white rounded-xl border border-black/5">
          <table className="w-full text-sm">
            <thead className="text-left text-on-surface-variant bg-surface-low">
              <tr>
                <th className="p-3">Mã RF</th>
                <th className="p-3">Số tiền</th>
                <th className="p-3">Tài khoản nhận</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id} className="border-t border-outline-variant/20">
                  <td className="p-3 font-mono">
                    <button onClick={() => copy(refund.refundReference)} className="inline-flex items-center gap-1 text-primary">
                      <Clipboard size={14} /> {refund.refundReference}
                    </button>
                  </td>
                  <td className="p-3 font-semibold">{formatMoney(refund.amount)}</td>
                  <td className="p-3">
                    <div>{refund.refundBankName}</div>
                    <button onClick={() => copy(refund.refundAccountNumber)} className="font-mono text-primary">{refund.refundAccountNumber}</button>
                    <div className="text-xs text-on-surface-variant">{refund.refundAccountName}</div>
                  </td>
                  <td className="p-3">{statusLabel(refund)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {refund.status === 'PENDING' && (
                        <button disabled={isPending} onClick={() => markTransferred(refund)} className="p-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100" title="Đã chuyển khoản">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {refund.status === 'PENDING' && (
                        <button disabled={isPending} onClick={() => manualComplete(refund)} className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" title="Xác nhận thủ công">
                          <Clipboard size={16} />
                        </button>
                      )}
                      {refund.status === 'PENDING' && (
                        <button disabled={isPending} onClick={() => failRefund(refund)} className="p-2 rounded-lg bg-red-50 text-error hover:bg-red-100" title="Đánh dấu thất bại">
                          <XCircle size={16} />
                        </button>
                      )}
                      {refund.status === 'FAILED' && (
                        <button disabled={isPending} onClick={() => retryRefund(refund)} className="p-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100" title="Tạo refund mới">
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </div>
  );
}
