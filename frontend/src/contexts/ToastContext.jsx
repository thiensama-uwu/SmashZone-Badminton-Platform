import { createContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export const ToastContext = createContext(null);

const ICONS = {
  success: { Icon: CheckCircle, cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  error:   { Icon: AlertCircle, cls: 'text-error',       bg: 'bg-red-50 border-red-200' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  info:    { Icon: Info,        cls: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
};

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]); // max 5
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const api = {
    success: (msg, dur) => toast(msg, 'success', dur),
    error:   (msg, dur) => toast(msg, 'error', dur),
    warning: (msg, dur) => toast(msg, 'warning', dur),
    info:    (msg, dur) => toast(msg, 'info', dur),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: 360 }}
      >
        {toasts.map(({ id, message, type }) => {
          const { Icon, cls, bg } = ICONS[type] || ICONS.info;
          return (
            <div
              key={id}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm pointer-events-auto animate-slide-in ${bg}`}
              style={{ animation: 'toastIn 0.2s ease-out' }}
            >
              <Icon size={16} className={`shrink-0 mt-0.5 ${cls}`} />
              <p className="flex-1 text-on-surface leading-snug">{message}</p>
              <button
                onClick={() => dismiss(id)}
                className="shrink-0 text-outline hover:text-on-surface-variant transition-colors"
                aria-label="Đóng"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
