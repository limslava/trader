import type { NewsItem } from '../api';

const EVENT_RU: Record<string, string> = {
  dividend: 'дивиденды',
  report: 'отчётность',
  sanction: 'санкции',
  halt: 'торги',
  buyback: 'выкуп акций',
  offering: 'размещение',
  rate: 'ставка ЦБ',
  legal: 'суд / штраф',
  deal: 'сделка',
  management: 'руководство',
  guidance: 'прогноз',
};

/** Event type, tone and importance of a classified headline. */
export function NewsChips({ n }: { n: NewsItem }) {
  const s = n.sentiment ?? null;
  const tone = s === null ? null : s >= 0.3 ? 'up' : s <= -0.3 ? 'down' : 'flat';
  const ev = n.event && EVENT_RU[n.event];
  if (!ev && tone === null && n.impact !== 'high') return null;
  return (
    <span className="mr-2 inline-flex flex-wrap items-center gap-1 align-middle">
      {n.impact === 'high' && <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-on-primary">важно</span>}
      {ev && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">{ev}</span>}
      {tone && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone === 'up' ? 'bg-up/12 text-up' : tone === 'down' ? 'bg-down/12 text-down' : 'bg-surface-2 text-muted'}`}
          title={`Тон для цены: ${s! > 0 ? '+' : ''}${s!.toFixed(1)}`}
        >
          {tone === 'up' ? 'позитив' : tone === 'down' ? 'негатив' : 'нейтрально'}
        </span>
      )}
    </span>
  );
}
