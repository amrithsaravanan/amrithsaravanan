import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { db } from '../lib/db';

type ToastKind = 'success' | 'error' | 'info';
interface ConfirmOpts { title: string; body: ReactNode; confirmLabel?: string; danger?: boolean }
interface Ctx { toast: (m: string, k?: ToastKind) => void; confirm: (o: ConfirmOpts) => Promise<boolean> }
const UICtx = createContext<Ctx>(null as unknown as Ctx);
export const useUI = () => useContext(UICtx);

export function Modal({ title, children, footer, onClose, wide }: { title: string; children: ReactNode; footer?: ReactNode; onClose?: () => void; wide?: boolean }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="modal-title">{title}</h2>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function ThemeEffect() {
  const row = useLiveQuery(() => db.settings.get('app'), []);
  const theme = row?.theme;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = theme ?? (localStorage.getItem('examlab-theme') as string | null) ?? 'system';
      document.documentElement.dataset.theme = t === 'dark' || (t === 'system' && mq.matches) ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return null;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; m: string; k: ToastKind }[]>([]);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const toast = useCallback((m: string, k: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, m, k }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };
  return (
    <UICtx.Provider value={{ toast, confirm }}>
      <ThemeEffect />
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.k}`}>
            {t.k === 'success' ? <CheckCircle2 size={16} /> : t.k === 'error' ? <XCircle size={16} /> : <Info size={16} />}
            <span>{t.m}</span>
          </div>
        ))}
      </div>
      {dlg && (
        <Modal title={dlg.title} onClose={() => close(false)} wide
          footer={<>
            <button className="btn" onClick={() => close(false)}>Cancel</button>
            <button className={`btn ${dlg.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>{dlg.confirmLabel ?? 'Confirm'}</button>
          </>}>
          {dlg.body}
        </Modal>
      )}
    </UICtx.Provider>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {actions && <div className="row gap">{actions}</div>}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden />
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}

export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="stat"><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{hint && <div className="caption">{hint}</div>}</div>
);
