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

const SIGNAL_STYLE: Record<Signal, { label: string; cls: string; hint: string }> = {
  BUY: { label: 'Покупать', cls: 'bg-up/15 text-up ring-up/30', hint: 'Технические данные говорят в пользу роста — можно присмотреться к покупке' },
  SELL: { label: 'Продавать', cls: 'bg-down/15 text-down ring-down/30', hint: 'Технические данные говорят в пользу снижения — покупать сейчас рискованно' },
  HOLD: { label: 'Держать', cls: 'bg-hold/15 text-hold ring-hold/30', hint: 'Нет явного перевеса: если бумага есть — держать, если нет — подождать' },
};

export function SignalBadge({ signal, confidence, size = 'sm' }: { signal: Signal; confidence?: number; size?: 'sm' | 'lg' }) {
  const s = SIGNAL_STYLE[signal];
  return (
    <span
      title={`${s.hint}${confidence !== undefined ? `. Уверенность AI: ${Math.round(confidence * 100)}%` : ''}`}
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold ring-1 ring-inset ${s.cls} ${size === 'lg' ? 'px-3 py-1 text-base' : 'px-2 py-0.5 text-xs'}`}
    >
      {s.label}
      {confidence !== undefined && <span className="font-normal opacity-80">{Math.round(confidence * 100)}%</span>}
    </span>
  );
}

/** Plain-language explanation block for beginners. */
export function SimpleBox({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Простыми словами</h3>
      <p className="text-sm leading-relaxed text-slate-100">{text}</p>
    </div>
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
