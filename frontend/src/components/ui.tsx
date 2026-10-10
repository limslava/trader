import { AlertCircle, ArrowDownRight, ArrowUpRight, LoaderCircle, Minus, Sparkles } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Signal } from '../api';

export function Card({
  title,
  actions,
  children,
  className = '',
  plain = false,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Render without frame/padding, for embedding inside panels and tabs. */
  plain?: boolean;
}) {
  if (plain) {
    return (
      <section className={className}>
        {actions && <div className="mb-3 flex flex-wrap items-center justify-end gap-2">{actions}</div>}
        {children}
      </section>
    );
  }
  return (
    <section className={`rounded-2xl border border-line/70 bg-panel shadow-card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-1">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'up' | 'down' };

export function Button({ variant = 'ghost', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-accent text-accent-fg hover:opacity-90 font-semibold shadow-sm',
    up: 'bg-up text-white hover:opacity-90 font-semibold shadow-sm dark:text-bg',
    down: 'bg-down text-white hover:opacity-90 font-semibold shadow-sm dark:text-bg',
    ghost: 'border border-line bg-panel text-fg hover:bg-panel-2',
    danger: 'border border-line bg-panel text-down hover:bg-down/10',
  }[variant];
  return (
    <button
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-3.5 py-1.5 text-sm transition duration-150 active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100 ${styles} ${className}`}
      {...props}
    />
  );
}

const SIGNAL_STYLE: Record<Signal, { label: string; cls: string; hint: string; Icon: typeof ArrowUpRight }> = {
  BUY: {
    label: 'Покупать',
    cls: 'bg-up/12 text-up',
    hint: 'Данные говорят в пользу роста — можно присмотреться к покупке',
    Icon: ArrowUpRight,
  },
  SELL: {
    label: 'Продавать',
    cls: 'bg-down/12 text-down',
    hint: 'Данные говорят в пользу снижения — покупать сейчас рискованно',
    Icon: ArrowDownRight,
  },
  HOLD: {
    label: 'Держать',
    cls: 'bg-hold/12 text-hold',
    hint: 'Нет явного перевеса: если бумага есть — держать, если нет — подождать',
    Icon: Minus,
  },
};

export function SignalBadge({ signal, confidence, size = 'sm' }: { signal: Signal; confidence?: number; size?: 'sm' | 'lg' }) {
  const s = SIGNAL_STYLE[signal];
  return (
    <span
      title={`${s.hint}${confidence !== undefined ? `. Уверенность AI: ${Math.round(confidence * 100)}%` : ''}`}
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${s.cls} ${size === 'lg' ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs'}`}
    >
      <s.Icon className={size === 'lg' ? 'size-4.5' : 'size-3.5'} strokeWidth={2.5} aria-hidden />
      {s.label}
      {confidence !== undefined && <span className="font-medium opacity-75">· {Math.round(confidence * 100)}%</span>}
    </span>
  );
}

/** Plain-language explanation block for beginners. */
export function SimpleBox({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-xl bg-accent/8 p-4">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent uppercase">
        <Sparkles className="size-3.5" aria-hidden />
        Простыми словами
      </h3>
      <p className="text-[15px] leading-relaxed text-fg">{text}</p>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <LoaderCircle className={`size-4 animate-spin ${className}`} aria-label="Загрузка" />;
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-down">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

/** Segmented control used for buy/sell, order type and chart periods. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-xl bg-panel-2 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg font-medium transition duration-150 ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'flex-1 px-4 py-1.5 text-sm'} ${
            o.value === value ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
