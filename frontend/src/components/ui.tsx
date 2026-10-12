import { AlertCircle, ArrowDownRight, ArrowUpRight, LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Signal } from '../api';
import { pct } from '../format';

export function Surface({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-[18px] border border-line/70 bg-surface shadow-soft ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'up' | 'down' | 'ai';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-on-primary hover:opacity-90',
    secondary: 'bg-surface-2 text-ink hover:bg-line/70',
    ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
    up: 'bg-up text-white hover:opacity-90 dark:text-bg',
    down: 'bg-down text-white hover:opacity-90 dark:text-bg',
    ai: 'bg-gradient-to-r from-accent to-accent-2 text-white shadow-[0_8px_24px_-10px_var(--accent)] hover:brightness-110',
  }[variant];
  const sizes = { sm: 'h-7 px-3 text-xs', md: 'h-9 px-4 text-sm', lg: 'h-10 px-5 text-sm' }[size];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${sizes} ${styles} ${className}`}
      {...props}
    />
  );
}

/** Price change pill with direction arrow; colour is never the only signal. */
export function Delta({ value, size = 'md', suffix }: { value: number | null | undefined; size?: 'sm' | 'md' | 'lg'; suffix?: string }) {
  const v = value ?? 0;
  const tone = v > 0 ? 'bg-up/12 text-up' : v < 0 ? 'bg-down/12 text-down' : 'bg-surface-2 text-muted';
  const Icon = v < 0 ? ArrowDownRight : ArrowUpRight;
  const sizes = { sm: 'px-1.5 py-0.5 text-[11px] gap-0.5', md: 'px-2 py-0.5 text-xs gap-0.5', lg: 'px-2.5 py-0.5 text-sm gap-0.5' }[size];
  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${tone} ${sizes}`}>
      {v !== 0 && <Icon className={size === 'lg' ? 'size-4' : 'size-3.5'} strokeWidth={2.5} aria-hidden />}
      {pct(value).replace('+', '')}
      {suffix && <span className="font-medium opacity-70">&nbsp;{suffix}</span>}
    </span>
  );
}

export const SIGNAL_META: Record<Signal, { label: string; verdict: string; tone: string; dot: string; hint: string }> = {
  BUY: {
    label: 'Покупать',
    verdict: 'Присмотреться к покупке',
    tone: 'text-up',
    dot: 'bg-up',
    hint: 'Данные говорят в пользу роста — можно присмотреться к покупке',
  },
  HOLD: {
    label: 'Держать',
    verdict: 'Держать и наблюдать',
    tone: 'text-hold',
    dot: 'bg-hold',
    hint: 'Нет явного перевеса: если бумага есть — держать, если нет — подождать',
  },
  SELL: {
    label: 'Продавать',
    verdict: 'Лучше обойти',
    tone: 'text-down',
    dot: 'bg-down',
    hint: 'Данные говорят в пользу снижения — покупать сейчас рискованно',
  },
};

export function SignalBadge({ signal, confidence }: { signal: Signal; confidence?: number }) {
  const s = SIGNAL_META[signal];
  return (
    <span
      title={s.hint}
      className={`inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${s.tone}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
      {confidence !== undefined && <span className="font-medium text-muted">{Math.round(confidence * 100)}%</span>}
    </span>
  );
}

/** Circular gauge for AI confidence. */
export function ConfidenceRing({ value, signal, size = 64 }: { value: number; signal: Signal; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = { BUY: 'var(--up)', HOLD: 'var(--hold)', SELL: 'var(--down)' }[signal];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Уверенность AI: насколько согласны между собой признаки">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <div className="text-base font-semibold">{Math.round(value * 100)}%</div>
          <div className="mt-0.5 text-[10px] text-muted">уверенность</div>
        </div>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, hint }: { label: ReactNode; value: ReactNode; sub?: ReactNode; hint?: string }) {
  return (
    <div title={hint}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden />;
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
  return <p className="py-8 text-center text-sm leading-relaxed text-muted">{children}</p>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className = '',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-full bg-surface-2 p-1 ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full font-semibold whitespace-nowrap transition duration-150 ${
            size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3.5 py-1 text-sm'
          } ${o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Plain-language explanation block for beginners. */
export function SimpleBox({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <div className="mb-1 text-xs font-semibold text-muted">Простыми словами</div>
      <p className="text-sm leading-relaxed text-ink">{text}</p>
    </div>
  );
}

/** Ticker monogram used in place of company logos. */
export function Monogram({ secid, size = 'md' }: { secid: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-8 text-[9px] rounded-[10px]', md: 'size-9 text-[10px] rounded-xl', lg: 'size-11 text-xs rounded-2xl' }[size];
  return (
    <span className={`grid shrink-0 place-items-center bg-primary font-bold tracking-tight text-on-primary ${sizes}`} aria-hidden>
      {secid.slice(0, 4)}
    </span>
  );
}

/** Underlined tabs for switching page sections. */
export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-line/70" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
            o.value === value ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
