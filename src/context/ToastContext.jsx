/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const toneStyles = {
  success: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  error: { icon: XCircle, className: 'text-rose-600 dark:text-rose-400' },
  warning: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  info: { icon: Info, className: 'text-brand-600 dark:text-brand-400' },
};

function ToastItem({ toast, onDismiss }) {
  const tone = toneStyles[toast.type] || toneStyles.info;
  const Icon = tone.icon;

  return (
    <div
      role={toast.type === 'error' ? 'alert' : undefined}
      className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <Icon size={20} className={`mt-0.5 shrink-0 ${tone.className}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 break-words text-sm text-slate-600 dark:text-slate-400">
            {toast.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 shrink-0 rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ type = 'info', title, message = '', duration = 4500 }) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        );
      }
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const api = useMemo(
    () => ({
      notify,
      dismiss,
      success: (title, message) => notify({ type: 'success', title, message }),
      error: (title, message) => notify({ type: 'error', title, message, duration: 7000 }),
      warning: (title, message) => notify({ type: 'warning', title, message, duration: 6000 }),
      info: (title, message) => notify({ type: 'info', title, message }),
    }),
    [notify, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}