import { config } from './config.js';
import { getMarketContext } from './context.js';
import { pool } from './db.js';
import { HttpError } from './http.js';
import { getQuotes } from './moex.js';
import { dividendCalendar } from './routes/calendar.js';
import { buildScorecard } from './scorecard.js';
import { portfolio } from './trading.js';

/**
 * Weekly Telegram digest: market pulse, watchlist moves, upcoming dividends, latest AI review and
 * how past verdicts fared. Plain text with HTML formatting; nothing here places orders.
 */

export function telegramConfigured(): boolean {
  return config.TELEGRAM_BOT_TOKEN.length > 0 && config.TELEGRAM_CHAT_ID.length > 0;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (v: number | null | undefined, d = 2) =>
  v == null ? '—' : new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v)}%`);
const ruDate = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '—');
const SIGNAL_RU = { BUY: 'покупать', HOLD: 'держать', SELL: 'продавать' } as const;

export async function buildDigest(): Promise<string> {
  const [ctx, cal, score] = await Promise.all([getMarketContext(), dividendCalendar(), buildScorecard()]);
  const { rows: watch } = await pool.query<{ secid: string; shortname: string }>('SELECT secid, shortname FROM watchlist ORDER BY added_at');
  const quotes = await getQuotes(watch.map((w) => w.secid));
  const pf = await portfolio().catch(() => null);
  const { rows: reviews } = await pool.query<{ scope: string; created_at: Date; result: { summary?: string; top?: { secid: string }[] } }>(
    `SELECT scope, created_at, result FROM reviews WHERE status = 'done' ORDER BY created_at DESC LIMIT 1`,
  );

  const lines: string[] = ['<b>Trader — недельный дайджест</b>', ''];

  if (ctx.imoex) {
    lines.push(
      `📈 <b>Индекс Мосбиржи</b> ${fmt(ctx.imoex.value)} · за неделю ${pct(ctx.imoex.change1wPct)} · за месяц ${pct(ctx.imoex.change1mPct)}`,
    );
  }
  if (ctx.keyRate) lines.push(`🏦 Ставка ЦБ ${fmt(ctx.keyRate.pct)}%${ctx.usdRub ? ` · доллар ${fmt(ctx.usdRub.rate)} ₽` : ''}`);

  if (pf) {
    const pnl = pf.positions.reduce((a, p) => a + (p.expectedYield ?? 0), 0);
    lines.push('', `💼 <b>Учебный портфель</b> ${fmt(pf.total, 0)} ₽ (${pnl >= 0 ? '+' : ''}${fmt(pnl, 0)} ₽) · свободно ${fmt(pf.availableCash, 0)} ₽`);
    for (const p of pf.positions.slice(0, 8)) {
      lines.push(`  ${esc(p.secid)} ${fmt(p.value, 0)} ₽${p.expectedYield != null ? ` (${p.expectedYield >= 0 ? '+' : ''}${fmt(p.expectedYield, 0)} ₽)` : ''}`);
    }
  }

  if (quotes.length) {
    lines.push('', '👀 <b>Вотчлист</b>');
    for (const q of quotes) lines.push(`  ${esc(q.secid)} ${fmt(q.price, q.decimals)} ₽ · сегодня ${pct(q.changePct)}`);
  }

  if (cal.upcoming.length) {
    lines.push('', '💸 <b>Ближайшие дивиденды</b>');
    for (const d of cal.upcoming.slice(0, 6)) {
      lines.push(
        `  ${esc(d.secid)} — ${fmt(d.amount)} ₽ (${fmt(d.yieldPct, 1)}%), купить до ${ruDate(d.lastBuyDate)}${d.expectedPayoutRub ? ` · вам ≈${fmt(d.expectedPayoutRub, 0)} ₽` : ''}`,
      );
    }
  }

  const r = reviews[0];
  if (r?.result.summary) {
    const scope = { imoex: 'рынка', watchlist: 'вотчлиста', portfolio: 'портфеля' }[r.scope] ?? r.scope;
    lines.push('', `🤖 <b>Последний AI-обзор ${scope}</b> (${ruDate(r.created_at.toISOString())})`, esc(r.result.summary));
    if (r.result.top?.length) lines.push(`Сильнее всего: ${r.result.top.map((t) => esc(t.secid)).join(', ')}`);
  }

  const settled = score.outcomes.filter((o) => o.returns[7] !== null);
  if (settled.length) {
    const hits = settled.filter((o) => o.hits[7]).length;
    lines.push('', `🎯 <b>Точность AI</b> за 7 дней: ${hits} из ${settled.length} (${Math.round((hits / settled.length) * 100)}%)`);
    for (const o of settled.slice(0, 4)) {
      lines.push(`  ${o.hits[7] ? '✅' : '❌'} ${esc(o.secid)} ${SIGNAL_RU[o.signal]} → ${pct(o.returns[7])}`);
    }
  }

  lines.push('', '<i>Не инвестиционная рекомендация. Решение принимаете вы.</i>');
  return lines.join('\n');
}

export async function sendTelegram(text: string): Promise<void> {
  if (!telegramConfigured()) throw new HttpError(503, 'Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env');
  const res = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: config.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { description?: string };
    throw new HttpError(502, `Telegram: ${body.description ?? res.status}`);
  }
}

/** Monday 09:00 MSK; checked every minute, sent at most once per week. */
export function scheduleWeeklyDigest(): void {
  if (!telegramConfigured()) return;
  let lastSentWeek = '';
  setInterval(async () => {
    const msk = new Date(Date.now() + 3 * 3600_000);
    const week = `${msk.getUTCFullYear()}-${Math.floor((msk.getTime() - Date.UTC(msk.getUTCFullYear(), 0, 1)) / (7 * 86_400_000))}`;
    if (msk.getUTCDay() !== 1 || msk.getUTCHours() !== 9 || lastSentWeek === week) return;
    lastSentWeek = week;
    try {
      await sendTelegram(await buildDigest());
      console.log('Weekly digest sent');
    } catch (err) {
      console.error('Weekly digest failed:', err instanceof Error ? err.message : err);
    }
  }, 60_000).unref();
}
