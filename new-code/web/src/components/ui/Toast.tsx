/**
 * Global toast system (UX-AUDIT Top-30 #2).
 *
 * One app-wide place for success / error / info feedback, replacing the ad-hoc
 * per-page inline notes that never dismissed (or vanished at random speeds).
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Status updated');
 *   toast.error('You can only edit records you own');
 *
 * - Auto-dismisses (success/info 4s, errors 6s; pass duration:0 to make sticky).
 * - Renders into document.body via a portal so it sits above modals.
 * - The viewport is an aria-live region; errors are role="alert" so assistive
 *   tech announces results (UX-AUDIT a11y theme).
 */
import React, {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  variant?: ToastVariant;
  /** ms before auto-dismiss; 0 keeps it until dismissed. */
  duration?: number;
}

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ToastApi {
  show: (message: string, opts?: ToastOptions) => void;
  success: (message: string, opts?: Omit<ToastOptions, 'variant'>) => void;
  error: (message: string, opts?: Omit<ToastOptions, 'variant'>) => void;
  info: (message: string, opts?: Omit<ToastOptions, 'variant'>) => void;
  warning: (message: string, opts?: Omit<ToastOptions, 'variant'>) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLE: Record<ToastVariant, { bg: string; border: string; fg: string; Icon: typeof Info }> = {
  success: { bg: '#F0FDF4', border: '#BBF7D0', fg: '#15803D', Icon: CheckCircle2 },
  error:   { bg: '#FEF2F2', border: '#FECACA', fg: '#B91C1C', Icon: AlertCircle },
  warning: { bg: '#FFFBEB', border: '#FDE68A', fg: '#B45309', Icon: AlertTriangle },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1D4ED8', Icon: Info },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const s = VARIANT_STYLE[item.variant];
  const { Icon } = s;
  return (
    <div
      role={item.variant === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        minWidth: 280, maxWidth: 420,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        color: s.fg,
        fontSize: 13,
        lineHeight: 1.45,
        pointerEvents: 'auto',
      }}
    >
      <Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{item.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onClose(item.id)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: s.fg, opacity: 0.6, padding: 0, flexShrink: 0, lineHeight: 0,
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, opts?: ToastOptions) => {
    const variant = opts?.variant ?? 'info';
    const duration = opts?.duration ?? (variant === 'error' ? 6000 : 4000);
    const id = (idRef.current += 1);
    setItems((prev) => [...prev, { id, variant, message, duration }]);
    if (duration > 0) window.setTimeout(() => remove(id), duration);
  }, [remove]);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (m, o) => show(m, { ...o, variant: 'success' }),
    error: (m, o) => show(m, { ...o, variant: 'error' }),
    info: (m, o) => show(m, { ...o, variant: 'info' }),
    warning: (m, o) => show(m, { ...o, variant: 'warning' }),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
            display: 'flex', flexDirection: 'column', gap: 10,
            pointerEvents: 'none',
          }}
        >
          {items.map((item) => (
            <ToastCard key={item.id} item={item} onClose={remove} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
