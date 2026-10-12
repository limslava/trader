import { z } from 'zod';
import { classifyHeadlines } from './ai.js';
import { pool } from './db.js';
import { KeyedLock, TtlCache } from './http.js';
import { COMMON_NAMES, decode, tag, type NewsItem } from './news.js';

/**
 * Primary Russian sources instead of an aggregator: wire agencies, business dailies, Finam's company feed,
 * CBR press releases and MOEX announcements. Headlines are matched to tickers by alias, tagged with an event
 * type by rules, and scored for tone by the model once (cached in news_items).
 */

const FEEDS: { source: string; url: string }[] = [
  { source: 'Интерфакс', url: 'https://www.interfax.ru/rss' },
  { source: 'Коммерсантъ', url: 'https://www.kommersant.ru/rss/news.xml' },
  { source: 'Ведомости', url: 'https://www.vedomosti.ru/rss/news' },
  { source: 'Финам', url: 'https://www.finam.ru/analysis/conews/rsspoint/' },
  { source: 'Финам', url: 'https://www.finam.ru/analysis/nslent/rsspoint/' },
  { source: 'Прайм', url: 'https://1prime.ru/export/rss2/index.xml' },
  { source: 'Банк России', url: 'https://www.cbr.ru/rss/RssPress' },
  { source: 'Мосбиржа', url: 'https://www.moex.com/export/news.aspx?cat=100' },
];

// Extra everyday spellings on top of COMMON_NAMES.
const EXTRA_ALIASES: Record<string, string[]> = {
  SBER: ['Сбер', 'Сбербанк', 'Sber'],
  GAZP: ['Газпром'],
  LKOH: ['Лукойл', 'ЛУКОЙЛ'],
  YDEX: ['Яндекс'],
  T: ['Т-Банк', 'Т-Технологии', 'ТКС'],
  VTBR: ['ВТБ'],
  GMKN: ['Норникель', 'Норильский никель'],
  NVTK: ['Новатэк', 'НОВАТЭК'],
  ROSN: ['Роснефть'],
  TATN: ['Татнефть'],
  MOEX: ['Мосбиржа', 'Московская биржа'],
  OZON: ['Ozon', 'Озон'],
  X5: ['X5', 'Пятёрочка', 'Икс 5'],
  PLZL: ['Полюс'],
  MTSS: ['МТС'],
  AFLT: ['Аэрофлот'],
  VKCO: ['VK', 'ВКонтакте'],
  POSI: ['Positive Technologies', 'Позитив'],
  MAGN: ['ММК', 'Магнитогорский'],
  CHMF: ['Северсталь'],
  NLMK: ['НЛМК'],
  PHOR: ['ФосАгро'],
  RUAL: ['Русал'],
  ALRS: ['Алроса', 'АЛРОСА'],
  AFKS: ['АФК Система', 'Система'],
  SNGS: ['Сургутнефтегаз'],
  TRNFP: ['Транснефть'],
  FLOT: ['Совкомфлот'],
  SVCB: ['Совкомбанк'],
  HEAD: ['HeadHunter', 'Хэдхантер', 'hh.ru'],
  CNRU: ['Циан'],
  UGLD: ['ЮГК', 'Южуралзолото'],
  RAGR: ['Русагро'],
  MDMG: ['Мать и дитя'],
  IRAO: ['Интер РАО'],
  RTKM: ['Ростелеком'],
  BSPB: ['Банк Санкт-Петербург', 'БСПБ'],
  CBOM: ['МКБ'],
  ENPG: ['Эн+', 'En+'],
  RENI: ['Ренессанс Страхование'],
  DOMRF: ['ДОМ.РФ'],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TICKER_PATTERNS: [string, RegExp][] = Object.entries({ ...COMMON_NAMES, ...EXTRA_ALIASES }).map(([secid, names]) => {
  const list = [...new Set([...(Array.isArray(names) ? names : [names]), ...(EXTRA_ALIASES[secid] ?? [])])];
  // Cyrillic word boundary: not preceded/followed by a letter, allowing Russian case endings ("Сбера", "Газпрома").
  return [secid, new RegExp(`(?<![\\p{L}])(?:${list.map(esc).join('|')})(?:[а-яё]{0,3})(?![\\p{L}])`, 'iu')];
});

const MARKET_RE = /ключев[а-яё]* ставк|Банк России|ЦБ РФ|\bЦБ\b|Мосбирж|индекс[а-яё]* Мосбиржи|IMOEX|санкци|курс рубля|нефт[а-яё]* Brent|Urals|ОФЗ|Минфин/iu;

export const EVENT_RULES: [string, RegExp][] = [
  ['dividend', /дивиденд|отсечк/iu],
  ['report', /отчётност|отчетност|МСФО|РСБУ|чист[а-яё]* прибыл|выручк|EBITDA|квартал[а-яё]* результат/iu],
  ['sanction', /санкци|SDN|ограничени[а-яё]* (ЕС|США)/iu],
  ['halt', /приостан[а-яё]* торг|остановк[а-яё]* торг|дискретн[а-яё]* аукцион/iu],
  ['buyback', /обратн[а-яё]* выкуп|buyback|байбэк/iu],
  ['offering', /\bSPO\b|\bIPO\b|допэмисси|размещени[а-яё]* акци/iu],
  ['rate', /ключев[а-яё]* ставк|заседани[а-яё]* ЦБ|совет[а-яё]* директоров Банка России/iu],
  ['legal', /\bсуд\b|иск\b|штраф|ФАС|уголовн/iu],
  ['deal', /сделк|приобрет|покупа[а-яё]* (долю|актив|компани)|прода[а-яё]* (долю|актив|бизнес)|слияни|поглощени/iu],
  ['management', /гендиректор|генеральн[а-яё]* директор|назначен|отставк|уволен|совет директоров утвердил/iu],
  ['guidance', /прогноз|ориентир|планирует|ожидает/iu],
];

export const EVENT_RU: Record<string, string> = {
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
  other: '',
};

export function tagEvent(title: string): string {
  return EVENT_RULES.find(([, re]) => re.test(title))?.[0] ?? 'other';
}

export function matchTickers(title: string): string[] {
  return TICKER_PATTERNS.filter(([, re]) => re.test(title)).map(([s]) => s);
}

type Raw = { url: string; title: string; source: string; publishedAt: string; summary: string | null };

async function fetchFeed(f: { source: string; url: string }): Promise<Raw[]> {
  const res = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Trader personal app)' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${f.source}: ${res.status}`);
  const xml = await res.text();
  const out: Raw[] = [];
  for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = decode(tag(block, 'title') ?? '');
    const url = decode(tag(block, 'link') ?? '').trim();
    const pub = new Date(decode(tag(block, 'pubDate') ?? ''));
    if (!title || !url || Number.isNaN(pub.getTime())) continue;
    const summary = decode(tag(block, 'description') ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500) || null;
    out.push({ url, title, source: f.source, publishedAt: pub.toISOString(), summary });
  }
  return out;
}

const refreshLock = new KeyedLock();
const refreshCache = new TtlCache<number>(10 * 60_000);

/** Pulls all feeds, stores new relevant items, classifies tone for the new ones. Safe to call often. */
export function refreshFeeds(): Promise<number> {
  return refreshCache.get('refresh', () =>
    refreshLock.run('feeds', async () => {
      const results = await Promise.allSettled(FEEDS.map(fetchFeed));
      const raw: Raw[] = [];
      results.forEach((r, i) => (r.status === 'fulfilled' ? raw.push(...r.value) : console.warn('Feed failed:', FEEDS[i].source, r.reason?.message ?? r.reason)));

      const cutoff = Date.now() - 14 * 86_400_000;
      const relevant = raw
        .filter((r) => Date.parse(r.publishedAt) > cutoff)
        .map((r) => ({ ...r, tickers: matchTickers(r.title), market: MARKET_RE.test(r.title), event: tagEvent(r.title) }))
        .filter((r) => r.tickers.length > 0 || r.market);

      let inserted = 0;
      for (const r of relevant) {
        const res = await pool.query(
          `INSERT INTO news_items (url, title, source, published_at, tickers, market, event, summary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (url) DO UPDATE SET summary = COALESCE(news_items.summary, EXCLUDED.summary)`,
          [r.url, r.title, r.source, r.publishedAt, r.tickers, r.market, r.event, r.summary],
        );
        inserted += res.rowCount ?? 0;
      }
      // Several batches per refresh, bounded so a backlog cannot burn the AI budget.
      for (let i = 0; i < 4; i++) {
        const n = await classifyPending().catch((err) => {
          console.warn('News classification failed:', err instanceof Error ? err.message : err);
          return 0;
        });
        if (n < 40) break;
      }
      return inserted;
    }),
  );
}

const classificationSchema = z.object({
  items: z.array(z.object({ id: z.coerce.number(), sentiment: z.coerce.number().min(-1).max(1), impact: z.enum(['low', 'medium', 'high']).catch('low') })),
});

/** Scores tone for unclassified headlines in one model call (up to 40 at a time). */
async function classifyPending(): Promise<number> {
  const { rows } = await pool.query<{ url: string; title: string; tickers: string[] }>(
    `SELECT url, title, tickers FROM news_items WHERE classified_at IS NULL ORDER BY published_at DESC LIMIT 40`,
  );
  if (rows.length === 0) return 0;
  const result = await classifyHeadlines(rows.map((r, id) => ({ id, title: r.title, tickers: r.tickers })), classificationSchema);
  const byId = new Map(result.items.map((i) => [i.id, i]));
  for (const [id, r] of rows.entries()) {
    const c = byId.get(id);
    await pool.query(`UPDATE news_items SET sentiment = $2, impact = $3, classified_at = now() WHERE url = $1`, [
      r.url,
      c ? Number(c.sentiment.toFixed(2)) : null,
      c?.impact ?? 'low',
    ]);
  }
  return rows.length;
}

type Row = { url: string; title: string; source: string; published_at: Date; tickers: string[]; market: boolean; event: string; sentiment: string | null; impact: string | null };

const toItem = (r: Row): NewsItem => ({
  url: r.url,
  title: r.title,
  source: r.source,
  publishedAt: r.published_at.toISOString(),
  event: r.event,
  sentiment: r.sentiment === null ? null : Number(r.sentiment),
  impact: r.impact,
  tickers: r.tickers,
});

export async function newsForTicker(secid: string, days = 14, limit = 12): Promise<NewsItem[]> {
  await refreshFeeds().catch(() => 0);
  const { rows } = await pool.query<Row>(
    `SELECT * FROM news_items WHERE $1 = ANY(tickers) AND published_at > now() - make_interval(days => $2) ORDER BY published_at DESC LIMIT $3`,
    [secid, days, limit],
  );
  return rows.map(toItem);
}

export async function marketNews(days = 7, limit = 15): Promise<NewsItem[]> {
  await refreshFeeds().catch(() => 0);
  const { rows } = await pool.query<Row>(
    `SELECT * FROM news_items WHERE (market OR impact = 'high') AND published_at > now() - make_interval(days => $1) ORDER BY published_at DESC LIMIT $2`,
    [days, limit],
  );
  return rows.map(toItem);
}

/** Ticker-specific items in the last 36 hours that the model judged important or strongly toned. */
export async function urgentEvents(hours = 36, limit = 10): Promise<NewsItem[]> {
  await refreshFeeds().catch(() => 0);
  const { rows } = await pool.query<Row>(
    `SELECT * FROM news_items
     WHERE cardinality(tickers) > 0 AND published_at > now() - make_interval(hours => $1)
       AND (impact = 'high' OR abs(coalesce(sentiment, 0)) >= 0.5 OR event IN ('dividend', 'sanction', 'halt', 'report', 'offering'))
     ORDER BY (impact = 'high') DESC, abs(coalesce(sentiment, 0)) DESC, published_at DESC LIMIT $2`,
    [hours, limit],
  );
  return rows.map(toItem);
}
