import { Clock } from 'lucide-react';

/**
 * Data-freshness badge for a quote. `updateTime` is MOEX/T-Invest "HH:MM:SS" in Moscow time.
 * Older than 15 minutes means the exchange is closed (or the feed stalled), so the price is a last close, not live.
 */
export function Freshness({ updateTime }: { updateTime: string | null | undefined }) {
  if (!updateTime) return null;
  const now = new Date(Date.now() + 3 * 3600_000);
  const [h, m] = updateTime.split(':').map(Number);
  let ageMin = now.getUTCHours() * 60 + now.getUTCMinutes() - (h * 60 + m);
  if (ageMin < -60) ageMin += 24 * 60; // quote from before midnight MSK
  const stale = ageMin > 15;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${stale ? 'bg-surface-2 text-muted' : 'bg-up/12 text-up'}`}
      title={stale ? 'Цена последней сделки — биржа закрыта или данные задерживаются' : 'Котировка обновляется в реальном времени'}
    >
      <Clock className="size-3" aria-hidden />
      {stale ? `на ${updateTime.slice(0, 5)} МСК` : 'live'}
    </span>
  );
}
