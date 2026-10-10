import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Signal } from '../api';

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-panel ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };

export function Button({ variant = 'ghost', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-accent text-slate-950 hover:bg-blue-300 font-semibold',
    ghost: 'border border-line text-slate-200 hover:bg-panel-2',
    danger: 'border border-line text-down hover:bg-red-500/10',
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

const SIGNAL_STYLE: Record<Signal, { label: string; cls: string }> = {
  BUY: { label: 'Покупать', cls: 'bg-up/15 text-up ring-up/30' },
  SELL: { label: 'Продавать', cls: 'bg-down/15 text-down ring-down/30' },
  HOLD: { label: 'Держать', cls: 'bg-hold/15 text-hold ring-hold/30' },
};

export function SignalBadge({ signal, confidence, size = 'sm' }: { signal: Signal; confidence?: number; size?: 'sm' | 'lg' }) {
  const s = SIGNAL_STYLE[signal];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold ring-1 ring-inset ${s.cls} ${size === 'lg' ? 'px-3 py-1 text-base' : 'px-2 py-0.5 text-xs'}`}
    >
      {s.label}
      {confidence !== undefined && <span className="font-normal opacity-80">{Math.round(confidence * 100)}%</span>}
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="text-sm text-down">{error instanceof Error ? error.message : String(error)}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}
