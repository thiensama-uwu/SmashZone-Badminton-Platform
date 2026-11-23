import { useState, useCallback, useTransition } from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import { adminUsersApi } from '../../api/index';
import { useApi, clearCache } from '../../hooks/useApi';
import AsyncState from '../../components/AsyncState';
import { useToast } from '../../contexts/useToast';
import { useAuth } from '../../contexts/useAuth';

const roleLabels = { admin: 'Admin', staff: 'Nhân viên', customer: 'Khách hàng' };
const PAGE_SIZE = 12;

export default function UserManagementPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [isPending, startTransition] = useTransition();

  const fetcher = useCallback(() => {
    const params = { page, limit: PAGE_SIZE };
    if (search) params.search = search;
    return adminUsersApi.list(params);
  }, [page, search]);

  const { data, loading, error, refresh } = useApi(
    `admin:users:${search}:${page}`,
    fetcher,
    { ttlMs: 30_000, onError: (err) => toast.error(err.message || 'Không thể tải danh sách.') },
  );

  const users = data?.items || [];
  const pagination = data?.pagination || {};

  const doRefresh = () => { clearCache('admin:users'); refresh(); };

  const handleDeleteUser = (userId) => {
    startTransition(async () => {
      try {
        await adminUsersApi.remove(userId);
        toast.success('Đã xóa tài khoản vĩnh viễn.');
        setSelected(null);
        doRefresh();
      } catch (err) {
        toast.error(err.message || 'Xóa thất bại.');
      }
    });
  };


  const handleRoleChange = (userId, role) => {
    startTransition(async () => {
      try {
        await adminUsersApi.update(userId, { roles: [role] });
        toast.success('Đã cập nhật vai trò.');
        setSelected(null);
        doRefresh();
      } catch (err) {
        toast.error(err.message || 'Cập nhật thất bại.');
      }
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-on-surface">Quản lý tài khoản</h1>
        <button onClick={doRefresh} className="p-2 rounded-lg border border-outline-variant/30 hover:bg-surface-low transition-colors">
          <RefreshCw size={16} className={`text-on-surface-variant ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-background rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-on-surface">Chi tiết tài khoản</h2>
              <button onClick={() => setSelected(null)} className="text-outline hover:text-on-surface"><X size={20} /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Email', selected.email],
                ['Tên', selected.fullName || '—'],
                ['SĐT', selected.phone || '—'],
                ['Vai trò', selected.roles?.map(r => roleLabels[r] || r).join(', ')],
                ['Trạng thái', (
                  <span key="st" className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                    Hoạt động
                  </span>
                )],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="text-on-surface text-right">{value}</span>
                </div>
              ))}
            </div>

            {isAdmin && (
              <div className="mt-5 space-y-3">
                <p className="text-xs font-semibold text-on-surface-variant uppercase">Hành động</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => handleDeleteUser(selected.id)} disabled={isPending}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-error bg-red-50 hover:bg-red-100 disabled:opacity-60">
                    <X size={12} /> Xóa tài khoản
                  </button>
                </div>

                <p className="text-xs font-semibold text-on-surface-variant uppercase mt-3">Gán vai trò</p>
                <div className="flex gap-2 flex-wrap">
                  {['customer', 'staff', 'admin'].map(role => {
                    const selectedRole = selected.roles?.[0] || 'customer';
                    const has = selectedRole === role;
                    return (
                      <button key={role} disabled={isPending}
                        onClick={() => handleRoleChange(selected.id, role)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${has ? 'bg-primary text-white' : 'bg-surface-high text-on-surface-variant hover:bg-surface-container'}`}>
                        {roleLabels[role]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={() => setSelected(null)} className="w-full h-10 mt-5 rounded-xl font-medium text-on-surface border border-outline-variant/30 hover:bg-surface-low">Đóng</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input type="text" placeholder="Tìm theo email..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-low text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border" />
        </div>
      </div>

      {/* Table */}
      <AsyncState loading={loading} error={error} empty={!loading && users.length === 0}
        skeletonType="table" skeletonRows={6} skeletonCols={5} emptyText="Không tìm thấy tài khoản." retryFn={doRefresh}>
        <div className="bg-surface-lowest rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {['Email', 'Tên', 'Vai trò', 'Trạng thái', ''].map((h, i) => (
                  <th key={i} className={`text-left p-4 font-semibold text-on-surface-variant ${i === 1 ? 'hidden sm:table-cell' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                return (
                  <tr key={u.id} className="border-b border-outline-variant/10 hover:bg-surface-low transition-colors cursor-pointer" onClick={() => setSelected(u)}>
                    <td className="p-4 font-medium text-on-surface">{u.email}</td>
                    <td className="p-4 text-on-surface-variant hidden sm:table-cell">{u.fullName || '—'}</td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles?.map(r => (
                          <span key={r} className={`px-2 py-0.5 rounded text-[11px] font-medium ${r === 'admin' ? 'bg-purple-50 text-purple-700' : r === 'staff' ? 'bg-blue-50 text-blue-700' : 'bg-surface-high text-on-surface-variant'}`}>
                            {roleLabels[r] || r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4"><span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">Hoạt động</span></td>
                    <td className="p-4 text-right"><span className="text-xs font-medium text-primary">Chi tiết</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(pagination.totalPages || 0) > 1 && (
          <div className="flex items-center justify-center gap-2 mt-5">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-low disabled:opacity-40">← Trước</button>
            <span className="text-sm text-on-surface-variant">Trang {page} / {pagination.totalPages}</span>
            <button disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-low disabled:opacity-40">Sau →</button>
          </div>
        )}
      </AsyncState>
    </div>
  );
}
