import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Users } from 'lucide-react';
import { api } from '../api';
import { date, price } from '../format';
import { SectionHeader, SIGNAL_META, Surface } from './ui';

/** Brokerage-house targets (consensus + distribution) and disclosed insider trades. */
export function Analysts({ secid, currentPrice }: { secid: string; currentPrice: number | null }) {
  const company = useQuery({ queryKey: ['company', secid], queryFn: () => api.company(secid), staleTime: 60 * 60_000 });
  const data = company.data?.configured ? company.data.data : null;
  const f = data?.forecast;
  const insiders = (data?.insiders ?? []).slice(0, 6);
  if (!f && insiders.length === 0) return null;

  const total = f ? f.counts.buy + f.counts.hold + f.counts.sell : 0;
  const upside = f?.consensus.target && currentPrice ? ((f.consensus.target - currentPrice) / currentPrice) * 100 : f?.consensus.upsidePct;

  return (
    <Surface className="p-5">
      <SectionHeader title="Аналитики и инсайдеры" subtitle="Мнения брокерских домов — не факты; сделки менеджмента — сильный сигнал" />
      {f && (
        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div>
            <div className="text-xs font-medium text-muted">Консенсус {total} домов</div>
            <div className={`mt-1 text-xl font-semibold ${SIGNAL_META[f.consensus.recommendation].tone}`}>{SIGNAL_META[f.consensus.recommendation].label}</div>
            <div className="mt-2 text-sm">
              <span className="text-muted">Цель </span>
              <span className="font-semibold">{price(f.consensus.target)} ₽</span>
              {upside != null && (
                <span className={`ml-1.5 text-xs font-semibold ${upside >= 0 ? 'text-up' : 'text-down'}`}>
                  {upside > 0 ? '+' : ''}
                  {price(upside, 0)}%
                </span>
              )}
            </div>
            <div className="text-xs text-muted">
              диапазон {price(f.consensus.min)}–{price(f.consensus.max)} ₽
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Распределение рекомендаций">
              <span className="bg-up" style={{ width: `${(f.counts.buy / total) * 100}%` }} />
              <span className="bg-hold" style={{ width: `${(f.counts.hold / total) * 100}%` }} />
              <span className="bg-down" style={{ width: `${(f.counts.sell / total) * 100}%` }} />
            </div>
            <div className="mt-1.5 flex gap-3 text-xs text-muted">
              <span>
                <b className="text-up">{f.counts.buy}</b> покупать
              </span>
              <span>
                <b className="text-hold">{f.counts.hold}</b> держать
              </span>
              <span>
                <b className="text-down">{f.counts.sell}</b> продавать
              </span>
            </div>
          </div>
          <ul className="divide-y divide-line/70 text-sm">
            {f.targets.slice(0, 6).map((t, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate">{t.company}</span>
                <span className={`text-xs font-semibold ${SIGNAL_META[t.recommendation].tone}`}>{SIGNAL_META[t.recommendation].label}</span>
                <span className="w-20 text-right font-semibold">{price(t.target)} ₽</span>
                <span className="w-20 text-right text-xs text-muted">{date(t.date)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insiders.length > 0 && (
        <div className={f ? 'mt-5 border-t border-line/70 pt-5' : ''}>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4 text-muted" aria-hidden />
            Сделки инсайдеров
          </h3>
          <ul className="divide-y divide-line/70 text-sm">
            {insiders.map((d, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                {d.direction === 'buy' ? (
                  <ArrowDownLeft className="size-4 shrink-0 text-up" aria-label="покупка" />
                ) : (
                  <ArrowUpRight className="size-4 shrink-0 text-down" aria-label="продажа" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{d.who || 'Инсайдер'}</span>
                  <span className="block truncate text-xs text-muted">{d.position}</span>
                </span>
                <span className="text-right">
                  <span className={`block font-semibold ${d.direction === 'buy' ? 'text-up' : 'text-down'}`}>
                    {d.direction === 'buy' ? 'Купил' : 'Продал'} {price(d.quantity, 0)} шт.
                  </span>
                  <span className="block text-xs text-muted">
                    по {price(d.price)} ₽ · {date(d.date)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Surface>
  );
}
