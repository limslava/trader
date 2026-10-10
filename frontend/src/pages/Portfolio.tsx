import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Percent, Plus, Wallet, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError, type Operation } from '../api';
import { SandboxBadge } from '../components/TradeTicket';
import { Button, Empty, ErrorText, Monogram, SectionHeader, Skeleton, Surface } from '../components/ui';
import { dateTime, money, price } from '../format';

// Distinct but calm shades for the allocation bar; cash is always the neutral last segment.
const SEGMENT_COLORS = ['var(--ink)', 'var(--accent)', 'var(--accent-2)', 'var(--up)', 'var(--hold)', 'var(--down)', 'var(--muted)'];

function AmountForm({ cta, onSubmit, busy, initial = '100000' }: { cta: string; onSubmit: (v: number) => void; busy: boolean; initial?: string }) {
  const [value, setValue] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value.replace(/\s/g, ''));
    if (n > 0) onSubmit(n);
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <label className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          aria-label="Сумма, ₽"
          className="w-32 bg-transparent text-lg font-semibold outline-none"
        />
        <span className="text-muted">₽</span>
      </label>
      <Button type="submit" variant="primary" size="lg" disabled={busy}>
        {cta}
      </Button>
    </form>
  );
}

function OperationIcon({ op }: { op: Operation }) {
  const cls = 'grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2';
  if (op.operationType.includes('INPUT')) return <span className={cls}><Plus className="size-4 text-up" aria-hidden /></span>;
  if (op.operationType.includes('FEE') || op.title.toLowerCase().includes('комисси'))
    return <span className={cls}><Percent className="size-4 text-muted" aria-hidden /></span>;
  if ((op.payment ?? 0) < 0) return <span className={cls}><ArrowUpRight className="size-4 text-ink" aria-hidden /></span>;
  return <span className={cls}><ArrowDownLeft className="size-4 text-up" aria-hidden /></span>;
}

export function Portfolio() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['tradingStatus'], queryFn: api.tradingStatus, staleTime: Infinity });
  const enabled = !!status.data?.configured && status.data.sandbox;
  const pf = useQuery({ queryKey: ['portfolio'], queryFn: api.portfolio, enabled, refetchInterval: 15_000, retry: false });
  const noAccount = pf.error instanceof ApiError && pf.error.status === 409;
  const hasAccount = enabled && !!pf.data;
  const orders = useQuery({ queryKey: ['orders'], queryFn: api.orders, enabled: hasAccount, refetchInterval: 15_000 });
  const ops = useQuery({ queryKey: ['operations'], queryFn: api.operations, enabled: hasAccount });

  const refresh = () => {
    for (const key of ['portfolio', 'orders', 'operations']) qc.invalidateQueries({ queryKey: [key] });
  };
  const open = useMutation({ mutationFn: api.openAccount, onSuccess: refresh });
  const payIn = useMutation({ mutationFn: api.payIn, onSuccess: refresh });
  const cancel = useMutation({ mutationFn: api.cancelOrder, onSuccess: refresh });

  if (status.data && !enabled) {
    return (
      <Surface className="p-8">
        <h1 className="text-2xl font-semibold">Портфель</h1>
        <p className="mt-2 text-muted">
          {status.data.configured
            ? 'Торговля в приложении работает только в песочнице (TINKOFF_SANDBOX=true).'
            : 'Подключите T-Invest API: задайте TINKOFF_TOKEN (токен для песочницы) в backend/.env.'}
        </p>
      </Surface>
    );
  }

  if (noAccount) {
    return (
      <section className="relative overflow-hidden rounded-[28px] bg-primary p-8 text-on-primary md:p-12">
        <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-gradient-to-br from-accent/50 to-accent-2/40 blur-3xl" />
        <div className="relative max-w-xl">
          <Wallet className="mb-6 size-10 opacity-80" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Учебный счёт</h1>
          <p className="mt-3 text-[17px] leading-relaxed opacity-75">
            Песочница Т-Инвестиций: цены и сделки — как на настоящей бирже, а деньги виртуальные. Попробуйте купить первую акцию
            без всякого риска.
          </p>
          <div className="mt-8 [&_button]:bg-on-primary [&_button]:text-primary [&_input]:text-on-primary [&_label]:border-white/20 [&_label]:bg-white/10">
            <AmountForm cta="Открыть счёт" onSubmit={(v) => open.mutate(v)} busy={open.isPending} />
          </div>
          <div className="mt-3">
            <ErrorText error={open.error} />
          </div>
        </div>
      </section>
    );
  }

  const p = pf.data;
  const invested = p ? p.positions.reduce((a, x) => a + (x.value ?? 0), 0) : 0;
  const totalYield = p ? p.positions.reduce((a, x) => a + (x.expectedYield ?? 0), 0) : 0;
  const segments = p
    ? [
        ...p.positions.map((pos, i) => ({ label: pos.secid, value: pos.value ?? 0, color: SEGMENT_COLORS[i % (SEGMENT_COLORS.length - 1)] })),
        { label: 'Деньги', value: p.cash, color: 'var(--line)' },
      ].filter((s) => s.value > 0)
    : [];
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Портфель</h1>
        <SandboxBadge />
      </div>
      <ErrorText error={pf.error} />

      <Surface className="p-6 md:p-8">
        {!p ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="text-sm font-medium text-muted">Стоимость портфеля</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="text-5xl font-semibold tracking-[-0.03em] md:text-6xl">{money(p.total)}</span>
              {totalYield !== 0 && (
                <span className={`text-lg font-semibold ${totalYield > 0 ? 'text-up' : 'text-down'}`}>
                  {totalYield > 0 ? '+' : ''}
                  {price(totalYield)} ₽
                </span>
              )}
            </div>
            <div className="mt-8 flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Распределение портфеля">
              {segments.map((s) => (
                <span key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${money(s.value)}`} />
              ))}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {segments.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="font-medium">{s.label}</span>
                  <span className="text-muted">{price((s.value / total) * 100, 1)}%</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-line/70 pt-6 sm:grid-cols-3">
              <div>
                <div className="text-xs font-medium text-muted">Свободные деньги</div>
                <div className="mt-1 text-xl font-semibold">{money(p.availableCash)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted">В бумагах</div>
                <div className="mt-1 text-xl font-semibold">{money(invested)}</div>
              </div>
              {p.blockedCash > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted">В заявках</div>
                  <div className="mt-1 text-xl font-semibold">{money(p.blockedCash)}</div>
                </div>
              )}
            </div>
          </>
        )}
      </Surface>

      <Surface className="p-5 md:p-7">
        <SectionHeader title="Бумаги" />
        {p?.positions.length === 0 && (
          <Empty>
            Пока ничего не куплено. Откройте любую компанию — например, из раздела{' '}
            <Link to="/market" className="font-semibold text-ink underline">
              «Рынок»
            </Link>{' '}
            — справа будет форма сделки.
          </Empty>
        )}
        <ul className="divide-y divide-line/70">
          {p?.positions.map((pos) => (
            <li key={pos.secid}>
              <Link to={`/s/${pos.secid}`} className="flex items-center gap-4 py-4">
                <Monogram secid={pos.secid} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{pos.name || pos.secid}</span>
                  <span className="block text-sm text-muted">
                    {price(pos.quantity, 0)} шт. · {price(pos.currentPrice)} ₽
                    {pos.blockedLots > 0 && <span className="text-hold"> · {pos.blockedLots} лот. в заявке</span>}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-semibold">{money(pos.value)}</span>
                  {pos.expectedYield != null && (
                    <span className={`text-sm font-semibold ${pos.expectedYield >= 0 ? 'text-up' : 'text-down'}`}>
                      {pos.expectedYield > 0 ? '+' : ''}
                      {price(pos.expectedYield)} ₽
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Surface>

      {!!orders.data?.length && (
        <Surface className="p-5 md:p-7">
          <SectionHeader title="Активные заявки" subtitle="Неисполненные заявки песочница снимает в конце торговой сессии" />
          <ul className="divide-y divide-line/70">
            {orders.data.map((o) => (
              <li key={o.orderId} className="flex items-center gap-4 py-3">
                <Monogram secid={o.secid} size="sm" />
                <span className="flex-1 text-sm">
                  <span className={`font-semibold ${o.direction === 'buy' ? 'text-up' : 'text-down'}`}>
                    {o.direction === 'buy' ? 'Покупка' : 'Продажа'}
                  </span>{' '}
                  {o.secid} · {o.lotsExecuted}/{o.lotsRequested} лот. по {price(o.price)} ₽
                  <span className="block text-xs text-muted">{o.statusText}</span>
                </span>
                <Button size="sm" onClick={() => cancel.mutate(o.orderId)} disabled={cancel.isPending}>
                  <X className="size-3.5" aria-hidden />
                  Отменить
                </Button>
              </li>
            ))}
          </ul>
          <ErrorText error={cancel.error} />
        </Surface>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Surface className="p-5 md:p-7">
          <SectionHeader title="История операций" />
          {ops.data?.length === 0 && <Empty>Операций пока нет.</Empty>}
          <ul className="divide-y divide-line/70">
            {ops.data?.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <OperationIcon op={o} />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">
                    {o.title}
                    {o.secid && !o.secid.startsWith('RUB') && <span className="text-muted"> · {o.secid}</span>}
                  </span>
                  <span className="block text-xs text-muted">
                    {dateTime(o.date)}
                    {o.quantity > 0 && ` · ${o.quantity} шт. × ${price(o.price)} ₽`}
                  </span>
                </span>
                <span className={`text-sm font-semibold ${(o.payment ?? 0) > 0 ? 'text-up' : ''}`}>
                  {(o.payment ?? 0) > 0 ? '+' : ''}
                  {money(o.payment)}
                </span>
              </li>
            ))}
          </ul>
        </Surface>

        {p && (
          <Surface className="h-fit p-5 md:p-7">
            <SectionHeader title="Пополнить" subtitle="Виртуальные рубли, лимит 30 млн ₽ всего" />
            <AmountForm cta="Пополнить" onSubmit={(v) => payIn.mutate(v)} busy={payIn.isPending} initial="50000" />
            <div className="mt-2">
              <ErrorText error={payIn.error} />
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
}
