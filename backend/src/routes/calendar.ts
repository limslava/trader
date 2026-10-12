import { Router } from 'express';
import { pool } from '../db.js';
import { todayMsk } from '../http.js';
import { getDividends, tinkoffConfigured, type Dividend } from '../tinkoff.js';
import { portfolio } from '../trading.js';

export const calendarRouter = Router();

export type CalendarItem = Dividend & {
  secid: string;
  shortname: string;
  /** How many shares the user holds in the sandbox, and what the dividend would pay on them (before tax). */
  held: number;
  expectedPayoutRub: number | null;
  source: ('watchlist' | 'portfolio')[];
};

/** Upcoming and recent dividends across the watchlist and the sandbox portfolio. */
export async function dividendCalendar(): Promise<{ upcoming: CalendarItem[]; recent: CalendarItem[] }> {
  if (!tinkoffConfigured()) return { upcoming: [], recent: [] };
  const { rows: watch } = await pool.query<{ secid: string; shortname: string }>('SELECT secid, shortname FROM watchlist');
  const pf = await portfolio().catch(() => null);

  const sources = new Map<string, { shortname: string; held: number; source: CalendarItem['source'] }>();
  for (const w of watch) sources.set(w.secid, { shortname: w.shortname, held: 0, source: ['watchlist'] });
  for (const p of pf?.positions ?? []) {
    const existing = sources.get(p.secid);
    if (existing) {
      existing.held = p.quantity;
      existing.source.push('portfolio');
    } else sources.set(p.secid, { shortname: p.name || p.secid, held: p.quantity, source: ['portfolio'] });
  }

  const today = todayMsk();
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const upcoming: CalendarItem[] = [];
  const recent: CalendarItem[] = [];
  const secids = [...sources.keys()];
  for (let i = 0; i < secids.length; i += 5) {
    await Promise.all(
      secids.slice(i, i + 5).map(async (secid) => {
        const meta = sources.get(secid)!;
        const divs = await getDividends(secid).catch(() => []);
        for (const d of divs) {
          if (!d.recordDate) continue;
          const item: CalendarItem = {
            ...d,
            secid,
            shortname: meta.shortname,
            held: meta.held,
            expectedPayoutRub: d.amount != null && meta.held ? Number((d.amount * meta.held).toFixed(2)) : null,
            source: meta.source,
          };
          if (d.recordDate >= today) upcoming.push(item);
          else if (d.recordDate >= cutoff) recent.push(item);
        }
      }),
    );
  }
  upcoming.sort((a, b) => (a.lastBuyDate ?? a.recordDate ?? '').localeCompare(b.lastBuyDate ?? b.recordDate ?? ''));
  recent.sort((a, b) => (b.recordDate ?? '').localeCompare(a.recordDate ?? ''));
  return { upcoming, recent };
}

calendarRouter.get('/dividends', async (_req, res) => {
  res.json(await dividendCalendar());
});
