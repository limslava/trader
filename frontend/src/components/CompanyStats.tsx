import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { api, type Dividend, type Indicators } from '../api';
import { NewsChips } from './NewsChips';
import { ScoreBreakdown } from './ScoreBadge';
import { useWindows } from './Windows';
import { date, dateTime, money, pct, price } from '../format';
import { Delta, Empty, ErrorText, SectionHeader, Skeleton, Stat, Surface } from './ui';

function useCompany(secid: string) {
  return useQuery({ queryKey: ['company', secid], queryFn: () => api.company(secid), staleTime: 60 * 60_000 });
}

/** Where today's price sits within the 52-week range. */
function RangeBar({ low, high, value }: { low: number; high: number; value: number }) {
  const pos = Math.min(100, Math.max(0, ((value - low) / (high - low || 1)) * 100));
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-muted">
        <span>Минимум за год</span>
        <span>Максимум за год</span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-down/30 via-hold/30 to-up/30">
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface bg-ink shadow"
          style={{ left: `${pos}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between text-sm font-semibold">
        <span>{price(low)}</span>
        <span className="text-muted">сейчас {price(value)}</span>
        <span>{price(high)}</span>
      </div>
    </div>
  );
}

const HINTS: Record<string, string> = {
  peRatioTtm: 'За сколько лет прибыль окупит цену компании. Меньше — дешевле. На рынке РФ 3–7 — обычное дело.',
  priceToBookTtm: 'Цена к стоимости имущества компании. Меньше 1 — дешевле баланса.',
  netDebtToEbitda: 'За сколько лет можно погасить долг из прибыли. Больше 3 — долгов много.',
  roe: 'Сколько прибыли компания зарабатывает на деньги акционеров.',
  dividendYieldDailyTtm: 'Сколько процентов от цены выплачено дивидендами за год.',
};

const KEY_FIELDS: [string, string, 'money' | 'x' | 'pct'][] = [
  ['marketCapitalization', 'Капитализация', 'money'],
  ['revenueTtm', 'Выручка за год', 'money'],
  ['netIncomeTtm', 'Прибыль за год', 'money'],
  ['dividendYieldDailyTtm', 'Дивдоходность', 'pct'],
  ['peRatioTtm', 'P/E', 'x'],
  ['priceToBookTtm', 'P/B', 'x'],
  ['netDebtToEbitda', 'Долг / EBITDA', 'x'],
  ['roe', 'Рентабельность (ROE)', 'pct'],
];

const NEGATIVE_IS_BAD = new Set(['netIncomeTtm', 'roe', 'revenueTtm', 'peRatioTtm']);

function rsiText(v: number | null) {
  if (v == null) return '—';
  if (v >= 70) return 'перегрета';
  if (v <= 30) return 'перепродана';
  return 'нейтрально';
}

export function KeyStats({ secid, ind }: { secid: string; ind?: Indicators }) {
  const company = useCompany(secid);
  const score = useQuery({ queryKey: ['score', secid], queryFn: () => api.score(secid), staleTime: 15 * 60_000 });
  const ctx = useQuery({ queryKey: ['context'], queryFn: api.context, staleTime: 10 * 60_000 });
  const risk = useQuery({ queryKey: ['risk', secid], queryFn: () => api.risk(secid), staleTime: 60 * 60_000 });
  const f = company.data?.configured ? company.data.data?.fundamentals : null;
  const fields = KEY_FIELDS.filter(([k]) => f?.[k] != null);

  return (
    <Surface className="p-5 md:p-5">
      <SectionHeader title="Ключевые показатели" subtitle={f ? 'Отчётность за последние 12 месяцев' : undefined} />
      {score.data && (
        <div className="mb-5 rounded-2xl bg-surface-2/60 p-4">
          <ScoreBreakdown score={score.data} />
        </div>
      )}
      {f?.dividendYieldDailyTtm != null && ctx.data?.ofz?.y1 && (
        <p className="mb-4 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
          <span className="font-semibold">Сравните с безрисковой альтернативой:</span> дивиденды за год{' '}
          <b>{price(f.dividendYieldDailyTtm as number, 1)}%</b> против ОФЗ на 1 год <b>{price(ctx.data.ofz.y1.yieldPct, 1)}%</b>
          {ctx.data.keyRate && <> и вклада ≈ <b>{price(ctx.data.keyRate.pct, 1)}%</b></>}. Акция должна давать больше с учётом
          роста цены — иначе риск не окупается.
        </p>
      )}
      {company.isLoading && <Skeleton className="h-24" />}
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {fields.map(([k, label, kind]) => {
            const v = f![k] as number;
            const text = kind === 'money' ? money(v) : kind === 'pct' ? `${price(v, 1)}%` : price(v, 2);
            // Negative profit is bad; negative net debt means more cash than debt, which is good.
            const bad = v < 0 && NEGATIVE_IS_BAD.has(k);
            const hint = k === 'netDebtToEbitda' && v < 0 ? 'Отрицательное значение: денег у компании больше, чем долгов' : HINTS[k];
            return <Stat key={k} label={label} value={<span className={bad ? 'text-down' : ''}>{text}</span>} hint={hint} />;
          })}
        </div>
      )}
      {company.data && !f && !company.isLoading && (
        <p className="text-sm text-muted">
          {company.data.configured ? 'Отчётности нет — например, это фонд.' : 'Подключите T-Invest API, чтобы видеть отчётность.'}
        </p>
      )}

      {ind && (
        <div className="mt-7 space-y-6 border-t border-line/70 pt-6">
          {ind.low52w != null && ind.high52w != null && ind.close != null && <RangeBar low={ind.low52w} high={ind.high52w} value={ind.close} />}
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Stat label="За месяц" value={<Delta value={ind.change1mPct} />} />
            <Stat label="За 3 месяца" value={<Delta value={ind.change3mPct} />} />
            <Stat label="За год" value={<Delta value={ind.change1yPct} />} />
            <Stat
              label="Долгосрочный тренд"
              value={ind.sma200 == null || ind.close == null ? '—' : ind.close >= ind.sma200 ? 'Вверх' : 'Вниз'}
              hint="Цена выше или ниже средней за 200 дней"
            />
            <Stat label="Перегрев (RSI)" value={`${price(ind.rsi14, 0)} · ${rsiText(ind.rsi14)}`} hint=">70 — перегрета, <30 — перепродана" />
            <Stat label="Волатильность" value={ind.volatility20dPct == null ? '—' : `${price(ind.volatility20dPct, 0)}% год.`} hint="Насколько сильно скачет цена" />
            <Stat label="Дневной размах" value={`${price(ind.atr14)} ₽`} hint="ATR: на сколько бумага обычно двигается за день" />
            <Stat label="Оборот в день" value={money(ind.turnover20dAvgRub)} hint="Средний за 20 дней" />
          </div>
          {risk.data && risk.data.maxDrawdownPct != null && (
            <div className="rounded-2xl bg-surface-2 p-4">
              <div className="mb-3 text-xs font-semibold text-muted">Насколько «тряско» держать эту бумагу (за год)</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Stat
                  label="Худшая просадка"
                  value={<span className="text-down">{pct(risk.data.maxDrawdownPct)}</span>}
                  hint="Максимальное падение от пика до дна за последний год. Столько вы могли бы временно потерять, купив на пике."
                />
                <Stat label="Худший день" value={<span className="text-down">{pct(risk.data.worstDayPct)}</span>} hint="Самое сильное падение за один день" />
                <Stat label="Лучший день" value={<span className="text-up">{pct(risk.data.bestDayPct)}</span>} hint="Самый сильный рост за один день" />
                <Stat
                  label="Бета к индексу"
                  value={risk.data.beta != null ? `${price(risk.data.beta, 2)}×` : '—'}
                  hint="Насколько бумага повторяет движения индекса: 1 — как рынок, 1,5 — в полтора раза сильнее, 0,5 — вдвое спокойнее"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}

function DividendItem({ d, future }: { d: Dividend; future?: boolean }) {
  return (
    <li className="flex items-center gap-4 py-3">
      <div className={`w-24 shrink-0 text-sm ${future ? 'font-semibold text-up' : 'text-muted'}`}>{date(d.recordDate)}</div>
      <div className="flex-1 text-sm text-muted">купить до {date(d.lastBuyDate)}</div>
      <div className="text-right">
        <div className="font-semibold">{d.amount != null ? `${price(d.amount, Number.isInteger(d.amount) ? 0 : 2)} ₽` : '—'}</div>
        <div className="text-xs text-muted">{d.yieldPct != null ? `${price(d.yieldPct, 1)}%` : ''}</div>
      </div>
    </li>
  );
}

export function Dividends({ secid }: { secid: string }) {
  const company = useCompany(secid);
  const divs = company.data?.configured ? company.data.data?.dividends : null;
  if (!divs || (divs.upcoming.length === 0 && divs.recent.length === 0)) {
    return (
      <Surface className="p-5">
        <Empty>{company.isLoading ? 'Загружаю…' : 'По этой бумаге нет данных о дивидендах.'}</Empty>
      </Surface>
    );
  }
  const next = divs.upcoming[0];
  const today = new Date().toISOString().slice(0, 10);
  const canStillBuy = next && (next.lastBuyDate ?? '') >= today;

  return (
    <Surface className="p-5 md:p-5">
      <SectionHeader title="Дивиденды" subtitle="После отсечки цена обычно падает примерно на размер выплаты — это нормально" />
      {next && (
        <div className={`mb-4 flex gap-3 rounded-2xl p-4 ${canStillBuy ? 'bg-up/10' : 'bg-hold/10'}`}>
          <CalendarClock className={`mt-0.5 size-5 shrink-0 ${canStillBuy ? 'text-up' : 'text-hold'}`} aria-hidden />
          <p className="text-sm leading-relaxed">
            {canStillBuy ? (
              <>
                Объявлен дивиденд <b>{price(next.amount)} ₽</b> ({price(next.yieldPct, 1)}%). Чтобы получить его, купите акции не
                позже <b>{date(next.lastBuyDate)}</b>.
              </>
            ) : (
              <>
                Последний день покупки под ближайший дивиденд прошёл ({date(next.lastBuyDate)}). После отсечки {date(next.recordDate)}{' '}
                цена может снизиться примерно на {price(next.amount)} ₽.
              </>
            )}
          </p>
        </div>
      )}
      <ul className="divide-y divide-line/70">
        {divs.upcoming.map((d, i) => (
          <DividendItem key={`u${i}`} d={d} future />
        ))}
        {divs.recent.map((d, i) => (
          <DividendItem key={`r${i}`} d={d} />
        ))}
      </ul>
    </Surface>
  );
}

export function NewsFeed({ secid, title = 'Новости', limit = 8, action }: { secid?: string; title?: string; limit?: number; action?: ReactNode }) {
  const { open } = useWindows();
  const { data, isLoading, error } = useQuery({
    queryKey: ['news', secid ?? 'market'],
    queryFn: () => (secid ? api.news(secid) : api.marketNews()),
    staleTime: 15 * 60_000,
  });
  return (
    <Surface className="p-5 md:p-5">
      <SectionHeader title={title} subtitle="Интерфакс, Коммерсантъ, Ведомости, Финам, ЦБ и Мосбиржа за 2 недели; тон и важность оценивает AI" action={action} />
      <ErrorText error={error} />
      {isLoading && <Skeleton className="h-40" />}
      {data?.length === 0 && <Empty>Свежих новостей не нашлось.</Empty>}
      <ul className="divide-y divide-line/70">
        {data?.slice(0, limit).map((n) => (
          <li key={n.url}>
            <a
              href={n.url}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return; // let power users open a real tab
                e.preventDefault();
                open(n.url, n.title);
              }}
              className="group flex w-full gap-3 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug font-medium group-hover:underline">
                  <NewsChips n={n} />
                  {n.title}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {n.source}
                  {n.publishedAt && ` · ${dateTime(n.publishedAt)}`}
                </span>
              </span>
              <ExternalLink className="mt-1 size-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" aria-label="Читать в окне" />
            </a>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
