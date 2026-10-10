import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError, type Order, type OrderInput } from '../api';
import { SandboxBadge } from '../pages/Portfolio';
import { money, price } from '../format';
import { Button, Card, ErrorText, Segmented, Spinner } from './ui';

const COMMISSION = 0.0005;

function ConfirmDialog({
  input,
  amount,
  onConfirm,
  onCancel,
  busy,
}: {
  input: OrderInput & { name: string; lot: number; unitPrice: number };
  amount: number;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const buy = input.direction === 'buy';
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Подтвердите заявку</h2>
          <SandboxBadge />
        </div>
        <dl className="space-y-1.5 text-sm">
          {[
            ['Операция', <span className={buy ? 'text-up' : 'text-down'}>{buy ? 'Покупка' : 'Продажа'}</span>],
            ['Бумага', `${input.secid} · ${input.name}`],
            ['Количество', `${input.lots} лот. × ${input.lot} шт. = ${input.lots * input.lot} шт.`],
            ['Тип', input.type === 'market' ? 'По рынку (текущая цена)' : `Лимитная, цена ${price(input.price)} ₽`],
            ['Сумма ≈', money(amount)],
            ['Комиссия ≈', `${price(amount * COMMISSION)} ₽`],
          ].map(([k, v], i) => (
            <div key={i} className="flex justify-between gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        {input.type === 'market' && (
          <p className="text-xs text-muted">Рыночная заявка исполнится по цене последней сделки — она может немного отличаться.</p>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onCancel} disabled={busy}>
            Отмена
          </Button>
          <Button className="flex-1" variant={buy ? 'up' : 'down'} onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : buy ? 'Купить' : 'Продать'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderResult({ order }: { order: Order }) {
  const ok = order.status !== 'EXECUTION_REPORT_STATUS_REJECTED';
  return (
    <p className={`rounded-lg p-3 text-sm ${ok ? 'bg-up/10 text-up' : 'bg-down/10 text-down'}`}>
      {order.direction === 'buy' ? 'Покупка' : 'Продажа'} {order.secid}: {order.statusText}
      {order.lotsExecuted > 0 && order.totalAmount != null && ` — ${order.lotsExecuted} лот. на ${money(order.totalAmount)}`}
      {order.message && ` (${order.message})`}.{' '}
      <Link to="/portfolio" className="underline">
        Портфель
      </Link>
    </p>
  );
}

export function TradePanel({ secid, plain }: { secid: string; plain?: boolean }) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [lots, setLots] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [confirming, setConfirming] = useState(false);

  const status = useQuery({ queryKey: ['tradingStatus'], queryFn: api.tradingStatus, staleTime: Infinity });
  const enabled = !!status.data?.configured && status.data.sandbox;
  const inst = useQuery({
    queryKey: ['tradeInstrument', secid],
    queryFn: () => api.tradeInstrument(secid),
    enabled,
    refetchInterval: 30_000,
  });
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

  const noAccount = pf.error instanceof ApiError && pf.error.status === 409;
  if (noAccount) {
    return (
      <Card plain={plain} title="Купить / продать" actions={<SandboxBadge />}>
        <p className="text-sm text-muted">
          Чтобы попробовать купить бумагу на виртуальные деньги, откройте счёт песочницы на странице{' '}
          <Link to="/portfolio" className="text-accent hover:underline">
            «Портфель»
          </Link>
          .
        </p>
      </Card>
    );
  }

  const i = inst.data;
  const held = pf.data?.positions.find((p) => p.secid === secid);
  const freeLots = held ? held.lots - held.blockedLots : 0;
  const nLots = Math.max(0, Math.floor(Number(lots) || 0));
  const unitPrice = type === 'limit' ? Number(limitPrice.replace(',', '.')) || 0 : (i?.lastPrice ?? 0);
  const amount = i ? nLots * i.lot * unitPrice : 0;
  const maxBuyLots = i && unitPrice && pf.data ? Math.floor(pf.data.availableCash / (i.lot * unitPrice * (1 + COMMISSION))) : 0;

  const problem = !i
    ? null
    : !i.canTrade
      ? 'Торги сейчас закрыты — заявку можно выставить в торговую сессию (в будни примерно 7:00–23:50 МСК, в выходные 10:00–19:00).'
      : type === 'market' && !i.marketOrderAvailable
        ? 'Рыночные заявки сейчас недоступны — выберите лимитную.'
        : nLots < 1
          ? 'Укажите количество лотов.'
          : type === 'limit' && unitPrice <= 0
            ? 'Укажите цену.'
            : direction === 'buy' && nLots > maxBuyLots
              ? `Не хватает денег: можно купить максимум ${maxBuyLots} лот.`
              : direction === 'sell' && nLots > freeLots
                ? freeLots
                  ? `Можно продать максимум ${freeLots} лот.`
                  : 'У вас нет этой бумаги — продавать нечего.'
                : null;

  return (
    <Card plain={plain} title="Купить / продать" actions={<SandboxBadge />}>
      {inst.isLoading && <Spinner className="text-muted" />}
      <ErrorText error={inst.error} />
      {i && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-muted">Цена: </span>
              {price(i.lastPrice)} ₽
            </span>
            <span>
              <span className="text-muted">Лот: </span>
              {i.lot} шт. ({money(i.lot * (i.lastPrice ?? 0))})
            </span>
            <span>
              <span className="text-muted">У вас: </span>
              {held ? `${held.lots} лот.` : 'нет'}
            </span>
            <span>
              <span className="text-muted">Свободно: </span>
              {money(pf.data?.availableCash)}
            </span>
            <span className={`inline-flex items-center gap-1.5 ${i.canTrade ? 'text-up' : 'text-hold'}`}>
              <span className="size-2 rounded-full bg-current" aria-hidden />
              {i.canTrade ? 'торги идут' : 'торги закрыты'}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Segmented
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'buy', label: 'Покупка' },
                { value: 'sell', label: 'Продажа' },
              ]}
            />
            <Segmented
              value={type}
              onChange={(t) => {
                setType(t);
                if (t === 'limit' && !limitPrice && i.lastPrice) setLimitPrice(String(i.lastPrice));
              }}
              options={[
                { value: 'market', label: 'По рынку' },
                { value: 'limit', label: 'Лимитная' },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Лотов</span>
              <input
                value={lots}
                onChange={(e) => setLots(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                className="w-24 rounded-xl border border-line bg-panel px-3 py-1.5 outline-none focus:border-accent"
              />
            </label>
            {type === 'limit' && (
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted">Цена за 1 шт., ₽</span>
                <input
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  inputMode="decimal"
                  className="w-32 rounded-xl border border-line bg-panel px-3 py-1.5 outline-none focus:border-accent"
                />
              </label>
            )}
            <div className="text-sm">
              <span className="mb-1 block text-xs text-muted">Сумма ≈</span>
              <span className="inline-block py-1.5 font-semibold">{money(amount)}</span>
            </div>
            <Button
              variant={direction === 'buy' ? 'up' : 'down'}
              className="ml-auto min-w-32 px-6 py-2.5 text-base"
              disabled={!!problem || place.isPending}
              onClick={() => setConfirming(true)}
            >
              {direction === 'buy' ? 'Купить' : 'Продать'}
            </Button>
          </div>

          {problem && <p className="text-sm text-hold">{problem}</p>}
          {type === 'limit' && (
            <p className="text-xs text-muted">
              Лимитная заявка исполнится, только когда цена дойдёт до указанной. Не исполнится до конца сессии — снимется.
            </p>
          )}
          <ErrorText error={place.error} />
          {place.data && <OrderResult order={place.data} />}
        </div>
      )}

      {confirming && i && (
        <ConfirmDialog
          input={{ secid, direction, lots: nLots, type, price: type === 'limit' ? unitPrice : undefined, name: i.name, lot: i.lot, unitPrice }}
          amount={amount}
          busy={place.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            place.mutate({ secid, direction, lots: nLots, type, price: type === 'limit' ? unitPrice : undefined })
          }
        />
      )}
    </Card>
  );
}
