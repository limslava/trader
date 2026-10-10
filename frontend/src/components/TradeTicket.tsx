import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Minus, Plus, ShieldCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError, type Order, type OrderInput } from '../api';
import { money, price } from '../format';
import { Button, ErrorText, Segmented, Skeleton, Spinner } from './ui';

const COMMISSION = 0.0005;

export function SandboxBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-hold/12 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-hold"
      title="Учебный счёт Т-Инвестиций: цены настоящие, деньги виртуальные"
    >
      <ShieldCheck className="size-3.5" aria-hidden />
      Песочница
    </span>
  );
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted">{k}</span>
      <span className={strong ? 'text-base font-semibold' : 'font-medium'}>{v}</span>
    </div>
  );
}

function Confirm({
  input,
  name,
  lot,
  amount,
  onConfirm,
  onCancel,
  busy,
}: {
  input: OrderInput;
  name: string;
  lot: number;
  amount: number;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const buy = input.direction === 'buy';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onCancel}>
      <div
        role="dialog"
        aria-label="Подтверждение заявки"
        className="w-full max-w-sm animate-rise space-y-5 rounded-3xl border border-line bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-muted">{buy ? 'Покупка' : 'Продажа'}</div>
            <div className="text-2xl font-semibold tracking-tight">{input.secid}</div>
            <div className="text-sm text-muted">{name}</div>
          </div>
          <SandboxBadge />
        </div>
        <div className="text-4xl font-semibold tracking-tight">{money(amount)}</div>
        <div className="space-y-2 rounded-2xl bg-surface-2 p-4">
          <Row k="Количество" v={`${input.lots} лот. · ${input.lots * lot} шт.`} />
          <Row k="Тип" v={input.type === 'market' ? 'По рынку' : `Лимит ${price(input.price)} ₽`} />
          <Row k="Комиссия ≈" v={`${price(amount * COMMISSION)} ₽`} />
        </div>
        {input.type === 'market' && <p className="text-xs leading-relaxed text-muted">Исполнится по цене последней сделки — она может немного отличаться.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={onCancel} disabled={busy}>
            Отмена
          </Button>
          <Button size="lg" variant={buy ? 'up' : 'down'} onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : buy ? 'Купить' : 'Продать'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Result({ order }: { order: Order }) {
  const ok = order.status !== 'EXECUTION_REPORT_STATUS_REJECTED';
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className={`flex gap-2 rounded-2xl p-3 text-sm ${ok ? 'bg-up/10 text-up' : 'bg-down/10 text-down'}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {order.direction === 'buy' ? 'Покупка' : 'Продажа'}: {order.statusText.toLowerCase()}
        {order.lotsExecuted > 0 && order.totalAmount != null && ` — ${order.lotsExecuted} лот. на ${money(order.totalAmount)}`}.{' '}
        <Link to="/portfolio" className="font-semibold underline">
          Портфель
        </Link>
      </span>
    </div>
  );
}

/** Buy/sell form for the T-Invest sandbox; rendered only when trading is available. */
export function TradeTicket({ secid }: { secid: string }) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [lots, setLots] = useState(1);
  const [limitPrice, setLimitPrice] = useState('');
  const [confirming, setConfirming] = useState(false);

  const status = useQuery({ queryKey: ['tradingStatus'], queryFn: api.tradingStatus, staleTime: Infinity });
  const enabled = !!status.data?.configured && status.data.sandbox;
  const inst = useQuery({ queryKey: ['tradeInstrument', secid], queryFn: () => api.tradeInstrument(secid), enabled, refetchInterval: 30_000 });
  const pf = useQuery({ queryKey: ['portfolio'], queryFn: api.portfolio, enabled, retry: false });

  const place = useMutation({
    mutationFn: api.placeOrder,
    onSuccess: () => {
      setConfirming(false);
      for (const key of ['portfolio', 'orders', 'operations']) qc.invalidateQueries({ queryKey: [key] });
    },
    onError: () => setConfirming(false),
  });

  if (!enabled) return null;

  if (pf.error instanceof ApiError && pf.error.status === 409) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-2">
          Попробуйте купить эту бумагу на виртуальные деньги — без риска. Сначала откройте учебный счёт.
        </p>
        <Link to="/portfolio">
          <Button variant="primary" className="w-full">
            Открыть учебный счёт
          </Button>
        </Link>
      </div>
    );
  }

  const i = inst.data;
  if (!i) return inst.error ? <ErrorText error={inst.error} /> : <Skeleton className="h-64" />;

  const held = pf.data?.positions.find((p) => p.secid === secid);
  const freeLots = held ? held.lots - held.blockedLots : 0;
  const unitPrice = type === 'limit' ? Number(limitPrice.replace(',', '.')) || 0 : (i.lastPrice ?? 0);
  const amount = lots * i.lot * unitPrice;
  const maxBuy = unitPrice && pf.data ? Math.floor(pf.data.availableCash / (i.lot * unitPrice * (1 + COMMISSION))) : 0;
  const max = direction === 'buy' ? maxBuy : freeLots;

  const problem = !i.canTrade
    ? 'Биржа сейчас закрыта. Торги: в будни ~7:00–23:50, в выходные 10:00–19:00 МСК.'
    : type === 'market' && !i.marketOrderAvailable
      ? 'Сейчас доступны только лимитные заявки.'
      : type === 'limit' && unitPrice <= 0
        ? 'Укажите цену.'
        : lots > max
          ? direction === 'buy'
            ? `Хватает максимум на ${maxBuy} лот.`
            : freeLots
              ? `Можно продать максимум ${freeLots} лот.`
              : 'Этой бумаги нет в портфеле.'
          : null;

  const input: OrderInput = { secid, direction, lots, type, price: type === 'limit' ? unitPrice : undefined };

  return (
    <div className="space-y-4">
      <Segmented
        className="w-full"
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'buy', label: 'Купить' },
          { value: 'sell', label: 'Продать' },
        ]}
      />

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-2">
        <button
          onClick={() => setLots((l) => Math.max(1, l - 1))}
          className="grid size-11 place-items-center rounded-xl bg-surface text-ink shadow-sm transition active:scale-95"
          aria-label="Меньше лотов"
        >
          <Minus className="size-4" />
        </button>
        <div className="text-center">
          <input
            value={lots}
            onChange={(e) => setLots(Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1))}
            inputMode="numeric"
            aria-label="Количество лотов"
            className="w-20 bg-transparent text-center text-2xl font-semibold outline-none"
          />
          <div className="text-xs text-muted">
            лот · {lots * i.lot} шт.
          </div>
        </div>
        <button
          onClick={() => setLots((l) => l + 1)}
          className="grid size-11 place-items-center rounded-xl bg-surface text-ink shadow-sm transition active:scale-95"
          aria-label="Больше лотов"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Segmented
          size="sm"
          value={type}
          onChange={(t) => {
            setType(t);
            if (t === 'limit' && !limitPrice && i.lastPrice) setLimitPrice(String(i.lastPrice));
          }}
          options={[
            { value: 'market', label: 'По рынку' },
            { value: 'limit', label: 'Лимит' },
          ]}
        />
        {type === 'limit' && (
          <label className="flex flex-1 items-center gap-1 rounded-full border border-line bg-surface px-3">
            <input
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              inputMode="decimal"
              aria-label="Цена за 1 бумагу"
              className="h-8 w-full bg-transparent text-sm font-semibold outline-none"
            />
            <span className="text-sm text-muted">₽</span>
          </label>
        )}
      </div>

      <div className="space-y-2">
        <Row k="Цена" v={`${price(unitPrice)} ₽`} />
        <Row k="Свободно" v={money(pf.data?.availableCash)} />
        {held && <Row k="В портфеле" v={`${held.lots} лот.`} />}
        <div className="border-t border-line/70 pt-2">
          <Row k="Итого ≈" v={money(amount)} strong />
        </div>
      </div>

      {problem && <p className="text-sm leading-snug text-hold">{problem}</p>}
      <ErrorText error={place.error} />

      <Button
        size="lg"
        variant={direction === 'buy' ? 'up' : 'down'}
        className="w-full"
        disabled={!!problem || place.isPending}
        onClick={() => setConfirming(true)}
      >
        {direction === 'buy' ? 'Купить' : 'Продать'} {secid}
      </Button>
      {place.data && <Result order={place.data} />}

      {confirming && (
        <Confirm
          input={input}
          name={i.name}
          lot={i.lot}
          amount={amount}
          busy={place.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => place.mutate(input)}
        />
      )}
    </div>
  );
}
