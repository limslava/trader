import { useQuery } from '@tanstack/react-query';
import { Check, Target, X } from 'lucide-react';
import { Link } from 'react-router';
import { api, type Signal } from '../api';
import { dateTime, pct, price } from '../format';
import { Empty, ErrorText, SectionHeader, SIGNAL_META, Skeleton, Surface } from './ui';

const SIGNALS: Signal[] = ['BUY', 'HOLD', 'SELL'];

/** How the AI's past verdicts fared: hit rate and mean move at 7 and 30 days, recomputed from real prices. */
export function ScorecardCard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['scorecard'], queryFn: api.scorecard, staleTime: 10 * 60_000 });
  const settled = data?.outcomes.filter((o) => o.returns['7'] !== null) ?? [];
  const pending = (data?.outcomes.length ?? 0) - settled.length;

  return (
    <Surface className="p-5">
      <SectionHeader
        title="Точность AI"
        subtitle="Каждый вердикт сверяется с реальной ценой через 7 и 30 дней. «Покупать» верен, если цена выросла; «Продавать» — если упала; «Держать» — если осталась в ±5%."
      />
      <ErrorText error={error} />
      {isLoading && <Skeleton className="h-32" />}
      {data && data.total === 0 && <Empty>Вердиктов ещё нет.</Empty>}
      {data && data.total > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {SIGNALS.map((s) => {
              const m = SIGNAL_META[s];
              const r7 = data.bySignal[s]['7'];
              const r30 = data.bySignal[s]['30'];
              return (
                <div key={s} className="rounded-2xl bg-surface-2 p-4">
                  <div className={`text-sm font-semibold ${m.tone}`}>{m.label}</div>
                  {[
                    ['7 дней', r7],
                    ['30 дней', r30],
                  ].map(([label, r]) => {
                    const row = r as typeof r7;
                    return (
                      <div key={label as string} className="mt-2 flex items-baseline justify-between text-sm">
                        <span className="text-muted">{label as string}</span>
                        {row.settled ? (
                          <span>
                            <b>{Math.round((row.hits / row.settled) * 100)}%</b>
                            <span className="text-muted">
                              {' '}
                              ({row.hits}/{row.settled}) · {pct(row.meanReturnPct)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted">нет данных</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {pending > 0 && (
            <p className="mt-3 text-xs text-muted">
              Ещё {pending} вердикт(ов) моложе 7 дней — они подведутся позже. Чем больше история, тем честнее цифры: 3 из 4 — это ещё не статистика.
            </p>
          )}
          {settled.length > 0 && (
            <ul className="mt-4 divide-y divide-line/70">
              {settled.slice(0, 10).map((o) => (
                <li key={o.id}>
                  <Link to={`/s/${o.secid}`} className="flex items-center gap-3 py-2 text-sm">
                    {o.hits['7'] ? <Check className="size-4 text-up" aria-label="попадание" /> : <X className="size-4 text-down" aria-label="промах" />}
                    <span className="w-14 font-semibold">{o.secid}</span>
                    <span className={`text-xs font-semibold ${SIGNAL_META[o.signal].tone}`}>{SIGNAL_META[o.signal].label}</span>
                    <span className="text-xs text-muted">
                      {dateTime(o.createdAt)} · {price(o.price)} ₽
                    </span>
                    <span className="ml-auto text-xs">
                      <span className="text-muted">7д </span>
                      <b className={(o.returns['7'] ?? 0) >= 0 ? 'text-up' : 'text-down'}>{pct(o.returns['7'])}</b>
                      {o.returns['30'] !== null && (
                        <>
                          <span className="text-muted"> · 30д </span>
                          <b className={(o.returns['30'] ?? 0) >= 0 ? 'text-up' : 'text-down'}>{pct(o.returns['30'])}</b>
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <Target className="size-3.5" aria-hidden />
            Прошлые исходы передаются модели при новом анализе той же бумаги — она учится на своих промахах.
          </p>
        </>
      )}
    </Surface>
  );
}
