import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ShieldAlert, Sparkles, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { api } from '../api';
import { date, dateTime, price } from '../format';
import { ConfidenceRing, SIGNAL_META, Skeleton, Surface } from './ui';

function Row({ Icon, label, children, onClick }: { Icon: typeof Users; label: string; children: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <span className="w-24 shrink-0 text-sm text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2">
      {inner}
    </button>
  ) : (
    <div className="flex items-start gap-3 px-2 py-2">{inner}</div>
  );
}

/**
 * The one-screen answer for a beginner: what the AI thinks, what analysts think, the next dividend and the
 * top risks. Every row jumps to the tab with the details.
 */
export function DecisionSummary({ secid, currentPrice, onTab }: { secid: string; currentPrice: number | null; onTab: (tab: string) => void }) {
  const history = useQuery({ queryKey: ['analyses', secid], queryFn: () => api.analyses(secid) });
  const company = useQuery({ queryKey: ['company', secid], queryFn: () => api.company(secid), staleTime: 60 * 60_000 });

  const a = history.data?.[0];
  const data = company.data?.configured ? company.data.data : null;
  const f = data?.forecast;
  const next = data?.dividends.upcoming[0];
  const lastDiv = data?.dividends.recent[0];
  const upside = f?.consensus.target && currentPrice ? ((f.consensus.target - currentPrice) / currentPrice) * 100 : f?.consensus.upsidePct;
  const loading = history.isLoading || company.isLoading;

  return (
    <Surface className="p-4">
      {loading && <Skeleton className="h-28" />}
      {!loading && (
        <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
          <button onClick={() => onTab('ai')} className="flex items-center gap-4 rounded-2xl px-2 py-1 text-left transition hover:bg-surface-2">
            {a ? (
              <>
                <ConfidenceRing value={a.confidence} signal={a.signal} size={56} />
                <span>
                  <span className={`block text-lg font-semibold tracking-tight ${SIGNAL_META[a.signal].tone}`}>{SIGNAL_META[a.signal].verdict}</span>
                  <span className="block text-xs text-muted">AI-вердикт · {dateTime(a.createdAt)}</span>
                </span>
              </>
            ) : (
              <>
                <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-white">
                  <Sparkles className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-lg font-semibold tracking-tight">Вердикта ещё нет</span>
                  <span className="block text-xs text-muted">Нажмите, чтобы получить разбор AI</span>
                </span>
              </>
            )}
          </button>

          <div className="divide-y divide-line/70 md:border-l md:border-line/70 md:pl-4">
            <Row Icon={Users} label="Аналитики" onClick={() => onTab('analysts')}>
              {f ? (
                <>
                  <b className={SIGNAL_META[f.consensus.recommendation].tone}>{SIGNAL_META[f.consensus.recommendation].label}</b>
                  <span className="text-muted">
                    {' '}
                    · цель {price(f.consensus.target)} ₽
                    {upside != null && ` (${upside > 0 ? '+' : ''}${price(upside, 0)}%)`} · {f.counts.buy} из {f.counts.buy + f.counts.hold + f.counts.sell} домов за покупку
                  </span>
                </>
              ) : (
                <span className="text-muted">нет покрытия</span>
              )}
            </Row>
            <Row Icon={CalendarClock} label="Дивиденды" onClick={() => onTab('dividends')}>
              {next ? (
                <>
                  <b>{price(next.amount)} ₽</b>
                  <span className="text-muted">
                    {' '}
                    ({price(next.yieldPct, 1)}%) · купить до <b className="text-ink">{date(next.lastBuyDate)}</b>
                  </span>
                </>
              ) : lastDiv ? (
                <span className="text-muted">
                  последний {price(lastDiv.amount)} ₽ ({price(lastDiv.yieldPct, 1)}%) · {date(lastDiv.recordDate)}; новых не объявлено
                </span>
              ) : (
                <span className="text-muted">не платит</span>
              )}
            </Row>
            <Row Icon={ShieldAlert} label="Риски" onClick={() => onTab('ai')}>
              {a?.result.risks.length ? (
                <span className="text-ink-2">{a.result.risks.slice(0, 2).join(' · ')}</span>
              ) : (
                <span className="text-muted">появятся после анализа</span>
              )}
            </Row>
          </div>
        </div>
      )}
    </Surface>
  );
}
