'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

interface ToastOptions {
  /** Adds a button. A toast with an action does not auto-dismiss, so it
   *  cannot disappear before it has been acted on. */
  action?: ToastAction;
  /** Milliseconds before auto-dismiss. Ignored when an action is present. */
  duration?: number;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    options?: ToastOptions,
  ) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, action: options?.action }]);
    if (!options?.action) {
      const timer = setTimeout(() => removeToast(id), options?.duration ?? 3000);
      timers.current.set(id, timer);
    }
  }, [removeToast]);

  useEffect(() => {
    return () => {
      timers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const typeStyles: Record<ToastType, string> = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`${typeStyles[toast.type]} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 pointer-events-auto animate-in slide-in-from-right min-w-[280px] max-w-[400px]`}
          >
            <span className="flex-1 text-sm">{toast.message}</span>
            {toast.action && (
              <button
                onClick={async () => {
                  await toast.action?.onClick();
                  removeToast(toast.id);
                }}
                className="flex-shrink-0 px-2 py-1 rounded text-xs font-medium
                           bg-white/20 hover:bg-white/30 transition-colors"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/70 hover:text-white flex-shrink-0"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
