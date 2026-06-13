import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastId = 0;

const BORDER_COLORS: Record<ToastType, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  info: 'var(--color-accent)',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast container — bottom-right */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-[#202020] rounded-xl px-5 py-4 text-sm font-medium text-white animate-[toast-in_0.25s_ease-out] shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center gap-3"
            style={{ borderLeft: `4px solid ${BORDER_COLORS[toast.type]}` }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
