import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { t } from '../../i18n/store';
import type { Status } from './StatusChip';

interface ToastItem {
  id: number;
  status: Status;
  message: ReactNode;
}

interface ToastApi {
  show(message: ReactNode, status?: Status): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children, timeoutMs = 5000 }: { children: ReactNode; timeoutMs?: number }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: ReactNode, status: Status = 'info') => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, status, message }]);
      if (timeoutMs > 0) setTimeout(() => dismiss(id), timeoutMs);
    },
    [dismiss, timeoutMs],
  );
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="og-toasts" role="status" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className={`og-toast og-toast--${x.status}`}>
            <span>{x.message}</span>
            <button
              type="button"
              className="og-toast__close"
              aria-label={t('app.ds.dismiss')}
              onClick={() => dismiss(x.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
