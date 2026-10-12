import { TtlCache } from './http.js';

export type NewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  /** Set when the headline came through the classified primary-feed pipeline. */
  event?: string;
  sentiment?: number | null;
  impact?: string | null;
  tickers?: string[];
};

const cache = new TtlCache<NewsItem[]>(30 * 60_000);

export const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .trim();
}

export const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];

// MOEX names are abbreviated ("Татнфт 3ао", "ГМКНорНик"); news use the everyday names.
export const COMMON_NAMES: Record<string, string> = {
  AFKS: 'АФК Система', AFLT: 'Аэрофлот', ALRS: 'АЛРОСА', BSPB: 'Банк Санкт-Петербург', CBOM: 'МКБ',
  CHMF: 'Северсталь', CNRU: 'Циан', DOMRF: 'ДОМ.РФ', ENPG: 'Эн+', FLOT: 'Совкомфлот', GAZP: 'Газпром',
  GMKN: 'Норникель', HEAD: 'HeadHunter', IRAO: 'Интер РАО', LKOH: 'Лукойл', MAGN: 'ММК', MDMG: 'Мать и дитя',
  MOEX: 'Мосбиржа', MTSS: 'МТС', NLMK: 'НЛМК', NVTK: 'Новатэк', OZON: 'Ozon', PHOR: 'ФосАгро', PLZL: 'Полюс',
  POSI: 'Positive Technologies', RAGR: 'Русагро', RENI: 'Ренессанс Страхование', ROSN: 'Роснефть',
  RTKM: 'Ростелеком', RUAL: 'Русал', SBER: 'Сбербанк', SBERP: 'Сбербанк', SNGS: 'Сургутнефтегаз',
  SNGSP: 'Сургутнефтегаз', SVCB: 'Совкомбанк', T: 'Т-Технологии', TATN: 'Татнефть', TATNP: 'Татнефть',
  TRNFP: 'Транснефть', UGLD: 'ЮГК', VKCO: 'VK', VTBR: 'ВТБ', X5: 'X5', YDEX: 'Яндекс',
};

/** Search phrase for a company's news: everyday name if known, otherwise the cleaned full MOEX name. */
export function companyQuery(secid: string, fullName: string): string {
  const name =
    COMMON_NAMES[secid] ??
    fullName
      .replace(/["«»()]/g, ' ')
      // \b is ASCII-only in JS, so use Unicode-aware boundaries for Cyrillic.
      .replace(/(?<![\p{L}\d])(МКПАО|ПАО|ОАО|АО|ао|ап|акц|акции|об|пр|вып|\d+)(?![\p{L}\d])\.?/giu, ' ')
      .replace(/[-–]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  return `"${name}" акции`;
}

export const MARKET_NEWS_QUERY = '"индекс Мосбиржи"';

/** Funds (БПИФ) track a basket, so market news is more relevant than news about the fund itself. */
export function newsQueryFor(secid: string, fullName: string): string {
  return /^БПИФ/i.test(fullName) ? MARKET_NEWS_QUERY : companyQuery(secid, fullName);
}

/**
 * Recent Russian-language headlines from Google News RSS (aggregates Interfax, RBC, Finam, BCS...).
 * Only headlines and sources: the AI must not pretend to know article contents.
 */
export function getNews(query: string, days = 14, limit = 15): Promise<NewsItem[]> {
  return cache.get(`${query}:${days}:${limit}`, async () => {
    const url = new URL('https://news.google.com/rss/search');
    url.searchParams.set('q', `${query} when:${days}d`);
    url.searchParams.set('hl', 'ru');
    url.searchParams.set('gl', 'RU');
    url.searchParams.set('ceid', 'RU:ru');
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Google News ${res.status}`);
    const xml = await res.text();

    const seen = new Set<string>();
    const items: NewsItem[] = [];
    for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const source = decode(tag(block, 'source') ?? '');
      let title = decode(tag(block, 'title') ?? '');
      // Titles come as "Headline - Source".
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      const key = title.toLowerCase();
      if (!title || seen.has(key)) continue;
      seen.add(key);
      const pub = new Date(decode(tag(block, 'pubDate') ?? ''));
      items.push({
        title,
        source,
        url: decode(tag(block, 'link') ?? ''),
        publishedAt: Number.isNaN(pub.getTime()) ? '' : pub.toISOString(),
      });
    }
    return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
  });
}

/** News never blocks analysis: on failure the AI simply gets no headlines. */
export async function getNewsSafe(query: string, days?: number, limit?: number): Promise<NewsItem[]> {
  try {
    return await getNews(query, days, limit);
  } catch (err) {
    console.warn('News fetch failed:', err);
    return [];
  }
}

/** Compact form for prompts: date, source, headline. */
/** Compact form for prompts: date, source, event tag, tone, headline. */
export const headlines = (items: NewsItem[]) =>
  items.map((n) => {
    const tags = [n.event && n.event !== 'other' ? n.event : null, n.sentiment != null ? `тон ${n.sentiment > 0 ? '+' : ''}${n.sentiment.toFixed(1)}` : null, n.impact === 'high' ? 'важно' : null]
      .filter(Boolean)
      .join(', ');
    return `${n.publishedAt.slice(0, 10)} [${n.source}]${tags ? ` (${tags})` : ''} ${n.title}`;
  });
