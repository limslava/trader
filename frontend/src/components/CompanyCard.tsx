import { Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, type Dividend } from '../api';
import { date, money, price } from '../format';
import { Card, Empty, ErrorText, Spinner } from './ui';

// Absolute amounts in rubles; everything else is a ratio or a percentage.
const MONEY_FIELDS = new Set(['marketCapitalization', 'revenueTtm', 'ebitdaTtm', 'netIncomeTtm', 'freeCashFlowTtm']);

const HINTS: Record<string, string> = {
  peRatioTtm: 'За сколько лет прибыль окупит цену компании. Меньше — дешевле. На рынке РФ 3–7 — обычно.',
  priceToBookTtm: 'Цена к стоимости имущества компании. Меньше 1 — компания стоит дешевле своего баланса.',
  netDebtToEbitda: 'За сколько лет компания может погасить долг. Больше 3 — высокая долговая нагрузка.',
  roe: 'Сколько прибыли компания зарабатывает на деньги акционеров. Выше — эффективнее.',
  dividendYieldDailyTtm: 'Сколько процентов от цены акции выплачено дивидендами за последний год.',
};

function DividendRow({ d, upcoming }: { d: Dividend; upcoming?: boolean }) {
  return (
    <tr className={`border-t border-line ${upcoming ? 'bg-up/5' : ''}`}>
      <td className="px-3 py-2">{upcoming ? <span className="font-semibold text-up">{date(d.lastBuyDate)}</span> : date(d.lastBuyDate)}</td>
      <td className="px-3 py-2 text-muted">{date(d.recordDate)}</td>
      <td className="px-3 py-2 text-right">{d.amount != null ? `${price(d.amount, Number.isInteger(d.amount) ? 0 : 2)} ₽` : '—'}</td>
      <td className="px-3 py-2 text-right">{d.yieldPct != null ? `${price(d.yieldPct, 1)}%` : '—'}</td>
      <td className="px-3 py-2 text-muted">{date(d.paymentDate)}</td>
    </tr>
  );
}

export function CompanyCard({ secid, plain }: { secid: string; plain?: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['company', secid],
    queryFn: () => api.company(secid),
    staleTime: 60 * 60_000,
  });

  if (data && !data.configured) {
    return (
      <Card plain={plain} title="Отчётность и дивиденды">
        <p className="text-sm text-muted">Подключите T-Invest API (TINKOFF_TOKEN в backend/.env), чтобы видеть отчётность и дивиденды.</p>
      </Card>
    );
  }

  const info = data?.configured ? data.data : null;
  const f = info?.fundamentals;
  const divs = info?.dividends;
  const next = divs?.upcoming[0];
  const today = new Date().toISOString().slice(0, 10);
  const fields = data?.configured ? Object.entries(data.labels).filter(([k]) => f?.[k] != null) : [];

  return (
    <Card plain={plain} title="Отчётность и дивиденды" actions={isLoading ? <Spinner className="text-muted" /> : null}>
      <ErrorText error={error} />
      {data?.configured && !info && <Empty>Данные Т-Инвестиций сейчас недоступны.</Empty>}
      {info && !f && !divs?.upcoming.length && !divs?.recent.length && (
        <Empty>Для этой бумаги нет отчётности и дивидендов (например, у фондов).</Empty>
      )}

      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {fields.map(([key, label]) => {
            const v = f![key] as number;
            const negative = v < 0;
            return (
              <div key={key} className="rounded-lg bg-panel-2 px-3 py-2" title={HINTS[key]}>
                <div className="text-xs text-muted">
                  {label}
                  {HINTS[key] && <Info className="ml-1 inline size-3 opacity-60" aria-hidden />}
                </div>
                <div className={`mt-0.5 text-sm font-medium ${negative ? 'text-down' : ''}`}>
                  {MONEY_FIELDS.has(key) ? money(v) : price(v, 2)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {divs && (divs.upcoming.length > 0 || divs.recent.length > 0) && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Дивиденды</h3>
          {next &&
            ((next.lastBuyDate ?? '') >= today ? (
              <p className="mb-2 text-sm text-up">
                Объявлен дивиденд — чтобы его получить, купите акции не позже {date(next.lastBuyDate)}.
              </p>
            ) : (
              <p className="mb-2 text-sm text-hold">
                Последний день покупки под ближайший дивиденд уже прошёл ({date(next.lastBuyDate)}). После отсечки{' '}
                {date(next.recordDate)} цена может снизиться примерно на размер дивиденда.
              </p>
            ))}
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-3 pb-2 font-normal">Последний день покупки</th>
                  <th className="px-3 pb-2 font-normal">Дата отсечки</th>
                  <th className="px-3 pb-2 text-right font-normal">На акцию</th>
                  <th className="px-3 pb-2 text-right font-normal">Доходность</th>
                  <th className="px-3 pb-2 font-normal">Выплата</th>
                </tr>
              </thead>
              <tbody>
                {divs.upcoming.map((d, i) => <DividendRow key={`u${i}`} d={d} upcoming />)}
                {divs.recent.map((d, i) => <DividendRow key={`r${i}`} d={d} />)}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">После даты отсечки цена обычно падает примерно на размер дивиденда — это нормально.</p>
        </div>
      )}
    </Card>
  );
}
