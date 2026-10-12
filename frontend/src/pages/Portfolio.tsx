import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Percent, Plus, Wallet, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError, type Operation } from '../api';
import { DividendCalendar } from '../components/DividendCalendar';
import { ReviewCard } from '../components/ReviewCard';
import { SectorBar } from '../components/SectorBar';
import { TradeDialog } from '../components/TradeDialog';
import { SandboxBadge } from '../components/TradeTicket';
import { Button, Empty, ErrorText, Monogram, SectionHeader, Skeleton, Surface, Tabs } from '../components/ui';
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
      <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5">
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
  // undefined: dialog closed; '': open with instrument picker; ticker: trade that instrument.
  const [trade, setTrade] = useState<string>();
  const [tab, setTab] = useState<'positions' | 'review' | 'dividends' | 'orders' | 'operations' | 'payin'>('positions');
  const ai = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus, staleTime: Infinity });

  if (status.data && !enabled) {
    return (
      <Surface className="p-6">
        <h1 className="text-xl font-semibold">Портфель</h1>
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
      <section className="relative overflow-hidden rounded-[22px] bg-primary p-6 text-on-primary md:p-9">
        <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-gradient-to-br from-accent/50 to-accent-2/40 blur-3xl" />
        <div className="relative max-w-xl">
          <Wallet className="mb-6 size-10 opacity-80" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Учебный счёт</h1>
          <p className="mt-3 text-[15px] leading-relaxed opacity-75">
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SandboxBadge />
        <Button variant="up" className="ml-auto" onClick={() => setTrade('')}>
          <Plus className="size-4" aria-hidden />
          Купить бумагу
        </Button>
      </div>
      <ErrorText error={pf.error} />
      {trade !== undefined && <TradeDialog secid={trade || undefined} onClose={() => setTrade(undefined)} />}

      <Surface className="p-5">
        {!p ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="text-sm font-medium text-muted">Стоимость портфеля</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-semibold tracking-[-0.025em]">{money(p.total)}</span>
              {totalYield !== 0 && (
                <span className={`text-lg font-semibold ${totalYield > 0 ? 'text-up' : 'text-down'}`}>
                  {totalYield > 0 ? '+' : ''}
                  {price(totalYield)} ₽
                </span>
              )}
            </div>
            <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Распределение портфеля">
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
            <div className="mt-5 border-t border-line/70 pt-4">
              <SectorBar positions={p.positions} cash={p.cash} total={p.total ?? 0} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line/70 pt-4 sm:grid-cols-3">
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

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'positions', label: `Бумаги${p?.positions.length ? ` · ${p.positions.length}` : ''}` },
          { value: 'review', label: 'AI-разбор' },
          { value: 'dividends', label: 'Дивиденды' },
          { value: 'orders', label: `Заявки${orders.data?.length ? ` · ${orders.data.length}` : ''}` },
          { value: 'operations', label: 'История' },
          { value: 'payin', label: 'Пополнить' },
        ]}
      />

      {tab === 'positions' && (
      <Surface className="animate-rise p-5">
        {p?.positions.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted">Пока ничего не куплено. Выберите бумагу и купите на виртуальные деньги.</p>
            <Button variant="up" onClick={() => setTrade('')}>
              <Plus className="size-4" aria-hidden />
              Купить первую бумагу
            </Button>
          </div>
        )}
        <ul className="divide-y divide-line/70">
          {p?.positions.map((pos) => (
            <li key={pos.secid} className="flex items-center gap-3">
              <Link to={`/s/${pos.secid}`} className="flex min-w-0 flex-1 items-center gap-4 py-4">
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
              <Button size="sm" onClick={() => setTrade(pos.secid)}>
                Торговать
              </Button>
            </li>
          ))}
        </ul>
      </Surface>
      )}

      {tab === 'review' && <ReviewCard scope="portfolio" canRun={!!ai.data?.configured} count={p?.positions.length ?? 0} />}
      {tab === 'dividends' && <DividendCalendar />}

      {tab === 'orders' && (
        <Surface className="animate-rise p-5">
          <SectionHeader title="Активные заявки" subtitle="Неисполненные заявки песочница снимает в конце торговой сессии" />
          {orders.data?.length === 0 && <Empty>Активных заявок нет. Лимитные заявки ждут здесь, пока цена не дойдёт до указанной.</Empty>}
          <ul className="divide-y divide-line/70">
            {orders.data?.map((o) => (
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

      {tab === 'operations' && (
        <Surface className="animate-rise p-5">
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
      )}

      {tab === 'payin' && p && (
        <Surface className="animate-rise p-5">
          <SectionHeader title="Пополнить" subtitle="Виртуальные рубли, лимит 30 млн ₽ всего" />
          <AmountForm cta="Пополнить" onSubmit={(v) => payIn.mutate(v)} busy={payIn.isPending} initial="50000" />
          <div className="mt-2">
            <ErrorText error={payIn.error} />
          </div>
        </Surface>
      )}
    </div>
  );
}
