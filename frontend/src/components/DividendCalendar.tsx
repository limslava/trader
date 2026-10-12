import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router';
import { api, type CalendarItem } from '../api';
import { date, money, price } from '../format';
import { Empty, ErrorText, Monogram, SectionHeader, Skeleton, Surface } from './ui';

const daysUntil = (iso: string | null) => (iso ? Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000) : null);

function Item({ d, past }: { d: CalendarItem; past?: boolean }) {
  const left = daysUntil(d.lastBuyDate);
  return (
    <li>
      <Link to={`/s/${d.secid}`} className="flex items-center gap-3 py-2.5">
        <Monogram secid={d.secid} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {d.secid} <span className="font-normal text-muted">{d.shortname}</span>
          </span>
          <span className="block text-xs text-muted">
            {past ? `отсечка ${date(d.recordDate)}` : `купить до ${date(d.lastBuyDate)}`}
            {!past && left != null && left >= 0 && <b className={`ml-1 ${left <= 3 ? 'text-hold' : 'text-ink'}`}>· через {left} дн.</b>}
            {d.held > 0 && ` · у вас ${price(d.held, 0)} шт.`}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-sm font-semibold">{price(d.amount)} ₽</span>
          <span className="block text-xs text-muted">
            {price(d.yieldPct, 1)}%{d.expectedPayoutRub ? ` · вам ≈${money(d.expectedPayoutRub)}` : ''}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Upcoming dividends across the watchlist and sandbox portfolio; `compact` hides the card when empty. */
export function DividendCalendar({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['dividendCalendar'], queryFn: api.dividendCalendar, staleTime: 30 * 60_000 });
  if (compact && (!data || data.upcoming.length === 0)) return null;
  return (
    <Surface className="p-5">
      <SectionHeader
        title="Календарь дивидендов"
        subtitle="По бумагам из вотчлиста и портфеля. Чтобы получить дивиденд, купите не позже указанной даты."
      />
      <ErrorText error={error} />
      {isLoading && <Skeleton className="h-24" />}
      {data && data.upcoming.length === 0 && (
        <Empty>
          <CalendarClock className="mx-auto mb-2 size-5" aria-hidden />
          Объявленных дивидендов по вашим бумагам пока нет. Как только компания объявит отсечку, она появится здесь.
        </Empty>
      )}
      {!!data?.upcoming.length && <ul className="divide-y divide-line/70">{data.upcoming.map((d, i) => <Item key={`u${i}`} d={d} />)}</ul>}
      {!compact && !!data?.recent.length && (
        <>
          <h3 className="mt-5 mb-1 text-xs font-semibold text-muted">Недавно прошли</h3>
          <ul className="divide-y divide-line/70">
            {data.recent.map((d, i) => (
              <Item key={`r${i}`} d={d} past />
            ))}
          </ul>
        </>
      )}
    </Surface>
  );
}
