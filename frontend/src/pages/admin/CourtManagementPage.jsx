import { useState, useCallback, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, X, Trash2 } from 'lucide-react';
import { courtsApi } from '../../api/courts';

const BRANCH_LOCATION_MAP = {
  branch_hcm_1: 'Đà Nẵng',
  branch_dn_1: 'Đà Nẵng',
  branch_hn_1: 'Hà Nội',
};
import { useApi, clearCache } from '../../hooks/useApi';
import AsyncState from '../../components/AsyncState';
import { useToast } from '../../contexts/useToast';
import { useAuth } from '../../contexts/useAuth';

const statusConfig = {
  ACTIVE:    { label: 'Hoạt động', cls: 'bg-emerald-50 text-emerald-700' },
  INACTIVE:  { label: 'Đã xóa', cls: 'bg-surface-high text-on-surface-variant' },
  SUSPENDED: { label: 'Tạm dừng', cls: 'bg-red-50 text-error' },
};

export default function CourtManagementPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [policyTarget, setPolicyTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [isPending, startTransition] = useTransition();

  const fetcher = useCallback(() => courtsApi.list({ includeInactive: true, includeDeleted: true }), []);
  const { data, loading, error, refresh } = useApi('admin:courts:list', fetcher, {
    ttlMs: 60_000,
    onError: (err) => toast.error(err.message || 'Không thể tải danh sách sân.'),
  });

  const courts = data?.items || (Array.isArray(data) ? data : []);
  const isStaff = (user?.roles || []).includes('staff') && !(user?.roles || []).includes('admin');
  const filtered = courts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return a.name.localeCompare(b.name);
  });

  const doRefresh = () => { clearCache('admin:courts'); clearCache('courts:list'); refresh(); };

  const openCreate = () => navigate('/admin/courts/new');
  const openEdit = (c) => navigate(`/admin/courts/${c.id}/edit`);

  const handleDelete = (court) => {
    setDeleteTarget(court);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await courtsApi.remove(deleteTarget.id);
        toast.success('Đã xóa sân.');
        setDeleteTarget(null);
        doRefresh();
      } catch (err) {
        toast.error(err.message || 'Xóa thất bại.');
      }
    });
  };

  const handleReactivate = (court) => {
    startTransition(async () => {
      try {
        await courtsApi.update(court.id, { status: 'ACTIVE' });
        toast.success('Đã kích hoạt lại sân.');
        doRefresh();
      } catch (err) {
        toast.error(err.message || 'Thất bại.');
      }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-on-surface">Quản lý sân</h1>
        <div className="flex gap-2">
          <button onClick={doRefresh} className="p-2 rounded-lg border border-outline-variant/30 hover:bg-surface-low transition-colors">
            <RefreshCw size={16} className={`text-on-surface-variant ${loading ? 'animate-spin' : ''}`} />
          </button>
          {!isStaff && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-active transition-colors">
              <Plus size={16} /> Thêm sân
            </button>
          )}
        </div>
      </div>

      {policyTarget && <PolicyModal court={policyTarget} onClose={() => setPolicyTarget(null)} onDone={() => { setPolicyTarget(null); doRefresh(); }} />}
      {deleteTarget && <DeleteConfirmModal court={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input type="text" placeholder="Tìm theo tên sân..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-low text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border" />
        </div>
        <select 
          value={sortBy} 
          onChange={e => setSortBy(e.target.value)}
          className="h-10 px-3 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border w-full sm:w-auto"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="name">Tên sân (A-Z)</option>
        </select>
      </div>

      {/* Table */}
      <AsyncState loading={loading} error={error} empty={!loading && filtered.length === 0}
        skeletonType="table" skeletonRows={4} skeletonCols={5}
        emptyText="Chưa có sân nào." emptyAction={isStaff ? undefined : { label: '+ Thêm sân', onClick: openCreate }} retryFn={doRefresh}>
        <div className="bg-surface-lowest rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="text-left p-4 font-semibold text-on-surface-variant">Tên sân</th>
                <th className="text-left p-4 font-semibold text-on-surface-variant hidden sm:table-cell">Địa chỉ</th>
                <th className="text-left p-4 font-semibold text-on-surface-variant">Trạng thái</th>
                <th className="text-left p-4 font-semibold text-on-surface-variant hidden md:table-cell">Giá/h</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const status = statusConfig[c.status] || { label: c.status, cls: 'bg-surface-high text-on-surface-variant' };
                const defaultSchedules = (c.priceSchedules || []).filter((s) => s.type === 'default');
                const priceSource = defaultSchedules.length > 0 ? defaultSchedules : (c.priceSchedules || []);
                const price = [...priceSource]
                  .sort((a, b) => (b.priority || 0) - (a.priority || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]?.price;
                return (
                  <tr key={c.id} className="border-b border-outline-variant/10 hover:bg-surface-low transition-colors">
                    <td className="p-4 font-medium text-on-surface">{c.name}</td>
                    <td className="p-4 hidden sm:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
                        {BRANCH_LOCATION_MAP[c.branchId] || 'Đà Nẵng'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="p-4 text-on-surface hidden md:table-cell">
                      {price ? price.toLocaleString('vi-VN') + 'đ' : '—'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                         {!isStaff && <button onClick={() => openEdit(c)} className="text-xs font-medium text-primary hover:underline px-2">Sửa</button>}
                         {c.status === 'ACTIVE' ? (
                           <button onClick={() => handleDelete(c)} disabled={isPending || isStaff} className="p-1.5 rounded-lg hover:bg-red-50 text-error disabled:opacity-40" title="Xóa (soft)">
                             <Trash2 size={14} />
                           </button>
                         ) : (
                           <button onClick={() => handleReactivate(c)} disabled={isPending || isStaff} className="text-xs font-medium text-emerald-600 hover:underline px-2 disabled:opacity-40">
                             Kích hoạt
                           </button>
                         )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </div>
  );
}

function DeleteConfirmModal({ court, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-lowest rounded-2xl p-6 shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 size={20} className="text-error" />
          </div>
          <h3 className="text-lg font-bold text-on-surface">Xác nhận xóa sân</h3>
        </div>
        <p className="text-sm text-on-surface-variant mb-6">
          Bạn có chắc chắn muốn xóa sân <span className="font-semibold text-on-surface">"{court.name}"</span>?<br />
          <span className="text-xs">(Thao tác này sẽ soft-delete, dữ liệu vẫn được lưu)</span>
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-low transition-colors">
            Hủy
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-error hover:bg-red-600 transition-colors">
            Xóa sân
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyModal({ court, onClose, onDone }) {
  const toast = useToast();
  const refundHours = court.policy?.refundBeforeHours ?? 24;
  const refundPct = court.policy?.refundPercent ?? 100;
  const rescheduleHours = court.policy?.rescheduleBeforeHours ?? 6;
  const [priceType, setPriceType] = useState('default');
  const [price, setPrice] = useState(court.priceSchedules?.[0]?.price || 120000);
  const [submitting, setSubmitting] = useState(false);

  const handleSavePrice = async () => {
    setSubmitting(true);
    try {
      await courtsApi.addPriceSchedule(court.id, { type: priceType, priority: priceType === 'default' ? 1 : 10, price });
      toast.success('Đã lưu bảng giá.');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Lưu thất bại.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface-lowest rounded-2xl p-6 shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-on-surface">Chính sách — {court.name}</h3>
          <button onClick={onClose} className="text-outline hover:text-on-surface"><X size={20} /></button>
        </div>

        <div className="space-y-5">
          <section>
            <h4 className="text-sm font-semibold text-on-surface mb-3">Chính sách hoàn tiền</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Hoàn tiền trước (giờ)</label>
                <ReadonlyValue value={refundHours} />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Hoàn tiền (%)</label>
                <ReadonlyValue value={refundPct} />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Đổi lịch trước (giờ)</label>
                <ReadonlyValue value={rescheduleHours} />
              </div>
            </div>
          </section>

          <hr className="border-outline-variant/20" />

          <section>
            <h4 className="text-sm font-semibold text-on-surface mb-3">Bảng giá</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Loại</label>
                <select value={priceType} onChange={e => setPriceType(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border">
                  <option value="default">Mặc định</option>
                  <option value="peak-hour">Giờ cao điểm</option>
                  <option value="holiday">Ngày lễ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Giá (VNĐ)</label>
                <input type="number" min="0" step="10000" value={price} onChange={e => setPrice(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border" />
              </div>
            </div>
            <button onClick={handleSavePrice} disabled={submitting}
              className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-90 disabled:opacity-60">
              {submitting ? 'Đang lưu...' : 'Thêm bảng giá'}
            </button>
          </section>
        </div>

        <button onClick={onClose} className="w-full h-10 mt-5 rounded-xl font-medium text-on-surface border border-outline-variant/30 hover:bg-surface-low">Đóng</button>
      </div>
    </div>
  );
}

function ReadonlyValue({ value }) {
  return (
    <div className="w-full h-10 px-3 rounded-lg bg-surface-low text-sm text-on-surface ghost-border border flex items-center">
      {value}
    </div>
  );
}
