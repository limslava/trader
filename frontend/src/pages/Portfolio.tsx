import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../api';
import { Button, Card, Empty, ErrorText, Spinner } from '../components/ui';
import { dateTime, money, price } from '../format';

export function SandboxBadge() {
  return (
    <span className="rounded-full bg-hold/12 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-hold">
      Песочница · виртуальные деньги
    </span>
  );
}

function AmountForm({ label, cta, onSubmit, busy }: { label: string; cta: string; onSubmit: (v: number) => void; busy: boolean }) {
  const [value, setValue] = useState('100000');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(value.replace(/\s/g, ''));
    if (n > 0) onSubmit(n);
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <label className="text-sm text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="numeric"
        className="w-36 rounded-xl border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <span className="text-sm text-muted">₽</span>
      <Button type="submit" variant="primary" disabled={busy}>
        {cta}
      </Button>
    </form>
  );
}

export function Portfolio() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['tradingStatus'], queryFn: api.tradingStatus, staleTime: Infinity });
  const enabled = !!status.data?.configured && status.data.sandbox;
  const pf = useQuery({ queryKey: ['portfolio'], queryFn: api.portfolio, enabled, refetchInterval: 15_000 });
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
      <Card title="Портфель">
        <p className="text-sm text-muted">
          {status.data.configured
            ? 'Торговля в приложении работает только в песочнице (TINKOFF_SANDBOX=true).'
            : 'Подключите T-Invest API: задайте TINKOFF_TOKEN (токен для песочницы) в backend/.env.'}
        </p>
      </Card>
    );
  }

  if (noAccount) {
    return (
      <Card title="Портфель" actions={<SandboxBadge />}>
        <div className="space-y-4 text-sm text-fg-2">
          <p>
            Откройте учебный счёт в песочнице Т-Инвестиций: деньги на нём виртуальные, а цены и сделки — как на настоящей
            бирже. Отличный способ попробовать купить и продать без риска.
          </p>
          <AmountForm label="Стартовая сумма" cta="Открыть счёт" onSubmit={(v) => open.mutate(v)} busy={open.isPending} />
          <ErrorText error={open.error} />
        </div>
      </Card>
    );
  }

  const p = pf.data;
  const invested = p ? p.positions.reduce((a, x) => a + (x.value ?? 0), 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Портфель</h1>
        <SandboxBadge />
        {pf.isFetching && <Spinner className="text-muted" />}
      </div>
      <ErrorText error={pf.error} />

      {p && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Всего', money(p.total)],
            ['Свободные деньги', money(p.availableCash)],
            ['В бумагах', money(invested)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line/70 bg-panel p-5 shadow-card">
              <div className="text-sm font-medium text-muted">{label}</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
            </div>
          ))}
        </div>
      )}

      <Card title="Бумаги">
        {p?.positions.length === 0 && (
          <Empty>
            Пока ничего не куплено. Откройте страницу бумаги (через поиск, «Рынок» или вотчлист) — там есть кнопки «Купить» и
            «Продать».
          </Empty>
        )}
        {!!p?.positions.length && (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 pb-2 font-normal">Бумага</th>
                  <th className="px-4 pb-2 text-right font-normal">Кол-во</th>
                  <th className="px-4 pb-2 text-right font-normal">Цена</th>
                  <th className="px-4 pb-2 text-right font-normal">Стоимость</th>
                  <th className="px-4 pb-2 text-right font-normal">Доход</th>
                  <th className="px-4 pb-2 text-right font-normal">Доля</th>
                </tr>
              </thead>
              <tbody>
                {p.positions.map((pos) => (
                  <tr key={pos.secid} className="border-t border-line hover:bg-panel-2">
                    <td className="px-4 py-2.5">
                      <Link to={`/s/${pos.secid}`} className="hover:underline">
                        <span className="font-semibold">{pos.secid}</span>
                        <span className="ml-2 text-muted">{pos.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {price(pos.quantity, 0)} шт.
                      {pos.blockedLots > 0 && <span className="ml-1 text-xs text-hold">({pos.blockedLots} в заявке)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{price(pos.currentPrice)}</td>
                    <td className="px-4 py-2.5 text-right">{money(pos.value)}</td>
                    <td
                      className={`px-4 py-2.5 text-right ${(pos.expectedYield ?? 0) > 0 ? 'text-up' : (pos.expectedYield ?? 0) < 0 ? 'text-down' : 'text-muted'}`}
                      title={pos.averagePrice ? `Средняя цена покупки: ${price(pos.averagePrice)} ₽` : 'Песочница пока не считает среднюю цену'}
                    >
                      {pos.expectedYield != null ? `${pos.expectedYield > 0 ? '+' : ''}${price(pos.expectedYield)} ₽` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted">
                      {p.total && pos.value ? `${price((pos.value / p.total) * 100, 1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!!orders.data?.length && (
        <Card title="Активные заявки">
          <ul className="divide-y divide-line">
            {orders.data.map((o) => (
              <li key={o.orderId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className={o.direction === 'buy' ? 'text-up' : 'text-down'}>{o.direction === 'buy' ? 'Покупка' : 'Продажа'}</span>
                <Link to={`/s/${o.secid}`} className="font-semibold hover:underline">
                  {o.secid}
                </Link>
                <span>
                  {o.lotsExecuted}/{o.lotsRequested} лот. по {price(o.price)} ₽
                </span>
                <span className="text-muted">{o.statusText}</span>
                <Button className="ml-auto" variant="danger" onClick={() => cancel.mutate(o.orderId)} disabled={cancel.isPending}>
                  Отменить
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Неисполненные заявки песочница снимает в конце торговой сессии.</p>
          <ErrorText error={cancel.error} />
        </Card>
      )}

      <Card title="История операций">
        {ops.data?.length === 0 && <Empty>Операций пока нет.</Empty>}
        <ul className="divide-y divide-line">
          {ops.data?.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="w-28 text-xs text-muted">{dateTime(o.date)}</span>
              <span>{o.title}</span>
              {o.secid && !o.secid.startsWith('RUB') && (
                <Link to={`/s/${o.secid}`} className="font-semibold hover:underline">
                  {o.secid}
                </Link>
              )}
              {o.quantity > 0 && (
                <span className="text-muted">
                  {o.quantity} шт. × {price(o.price)} ₽
                </span>
              )}
              <span className={`ml-auto ${(o.payment ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                {(o.payment ?? 0) > 0 ? '+' : ''}
                {money(o.payment)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {p && (
        <Card title="Пополнить счёт">
          <AmountForm label="Сумма" cta="Пополнить" onSubmit={(v) => payIn.mutate(v)} busy={payIn.isPending} />
          <ErrorText error={payIn.error} />
          <p className="mt-2 text-xs text-muted">Виртуальные рубли песочницы, лимит — 30 млн ₽ всего.</p>
        </Card>
      )}
    </div>
  );
}
