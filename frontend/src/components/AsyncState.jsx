/**
 * AsyncState — Shared component for consistent loading / error / empty states.
 * Eliminates duplicated skeleton/error/empty boilerplate across all pages.
 *
 * Usage:
 *   <AsyncState loading={loading} error={error} empty={items.length === 0} emptyText="Chưa có dữ liệu">
 *     <YourContent />
 *   </AsyncState>
 */
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

// ─── Skeleton variants ────────────────────────────────────────────────────────
function CardSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Đang tải...">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-low animate-pulse" style={{ height: 64 }} />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="rounded-2xl bg-surface-lowest overflow-hidden shadow-sm" aria-busy="true">
      <div className="border-b border-outline-variant/20 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-surface-low animate-pulse flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 border-b border-outline-variant/10 flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 rounded bg-surface-low animate-pulse flex-1" style={{ opacity: 1 - j * 0.15 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function StatSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-low animate-pulse" style={{ height: 96 }} />
      ))}
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────
function ErrorState({ error, onRetry }) {
  const message = error?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center" role="alert">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
        <AlertCircle size={28} className="text-error" />
      </div>
      <div>
        <p className="font-semibold text-on-surface">{message}</p>
        <p className="text-sm text-on-surface-variant mt-1">Kiểm tra kết nối và thử lại.</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={14} /> Thử lại
        </button>
      )}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ text = 'Chưa có dữ liệu.', icon, action }) {
  const IconComp = icon || Inbox;
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-14 h-14 rounded-full bg-surface-low flex items-center justify-center">
        <IconComp size={26} className="text-outline" />
      </div>
      <p className="text-on-surface-variant text-sm">{text}</p>
      {action && (
        <button onClick={action.onClick} className="mt-1 text-sm font-medium text-primary hover:underline">
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * @param {{ loading, error, empty, skeletonType, skeletonRows, skeletonCols, emptyText, emptyIcon, retryFn, children }} props
 */
export default function AsyncState({
  loading,
  error,
  empty = false,
  skeletonType = 'card',     // 'card' | 'table' | 'stat'
  skeletonRows = 3,
  skeletonCols = 4,
  emptyText,
  emptyIcon,
  emptyAction,
  retryFn,
  children,
}) {
  if (error && !loading) return <ErrorState error={error} onRetry={retryFn} />;
  if (loading && !children) {
    if (skeletonType === 'table') return <TableSkeleton rows={skeletonRows} cols={skeletonCols} />;
    if (skeletonType === 'stat')  return <StatSkeleton count={skeletonRows} />;
    return <CardSkeleton rows={skeletonRows} />;
  }
  if (empty && !loading) return <EmptyState text={emptyText} icon={emptyIcon} action={emptyAction} />;
  return children;
}

export { CardSkeleton, TableSkeleton, StatSkeleton, ErrorState, EmptyState };
