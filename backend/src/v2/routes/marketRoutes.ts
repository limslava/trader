import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { MarketIngestionService } from '../services/MarketIngestion';
import axios from 'axios';
import { simpleRateLimit } from '../middleware/rateLimit';

const router = Router();
const ingestionService = new MarketIngestionService();
const MOEX_BASE = (process.env.MOEX_API_BASE_URL || 'https://iss.moex.com/iss').replace(/\/+$/, '');

const extractMarketdataValue = (marketdata: any, key: string): any => {
  const columns: string[] = marketdata?.columns || [];
  const data: any[] = marketdata?.data?.[0] || [];
  const idx = columns.indexOf(key);
  return idx >= 0 ? data[idx] : null;
};

router.post(
  '/ingest',
  authenticateV2,
  requireRole(['owner', 'admin', 'trader', 'analyst']),
  simpleRateLimit((req) => req.ip || 'unknown', 120, 60_000),
  async (req: AuthedRequest, res) => {
  const { symbol, price, ts, source } = req.body || {};

  if (!symbol || !price || !ts || !source) {
    return res.status(400).json({ error: 'Bad Request', message: 'symbol, price, ts, source required' });
  }

  const parsedPrice = Number(price);
  const parsedTs = Number(ts);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid price' });
  }
  if (!Number.isFinite(parsedTs) || parsedTs <= 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid timestamp' });
  }

  const normalized = await ingestionService.ingest({
    symbol: String(symbol),
    price: parsedPrice,
    ts: parsedTs,
    source
  });

  return res.status(202).json({ status: 'accepted', normalized });
});

router.get('/session', authenticateV2, async (_req: AuthedRequest, res) => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const weekday = getPart('weekday').toLowerCase();
  const hour = Number(getPart('hour'));
  const minute = Number(getPart('minute'));

  const isWeekend = weekday.startsWith('сб') || weekday.startsWith('вс');
  const minutes = hour * 60 + minute;
  const openMinutes = 10 * 60;
  const closeMinutes = 18 * 60 + 45;
  const isOpen = !isWeekend && minutes >= openMinutes && minutes <= closeMinutes;

  return res.status(200).json({
    market: 'MOEX',
    timezone: 'Europe/Moscow',
    now: now.toISOString(),
    open: isOpen,
    reason: isOpen ? 'trading_window' : (isWeekend ? 'weekend' : 'outside_trading_window'),
    window: { open: '10:00', close: '18:45' },
    note: 'Simplified schedule; does not include breaks/holidays.'
  });
});

router.post(
  '/ticks/sync',
  authenticateV2,
  requireRole(['owner', 'admin', 'trader', 'analyst']),
  simpleRateLimit((req) => req.ip || 'unknown', 60, 60_000),
  async (req: AuthedRequest, res) => {
    const { symbols, board } = req.body || {};
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'symbols array required' });
    }

    const boardId = String(board || 'TQBR').toUpperCase();
    const limited = symbols.slice(0, 25).map((s: string) => String(s).toUpperCase());
    const results: Array<{ symbol: string; status: string; price?: number }> = [];

    for (const symbol of limited) {
      try {
        const url = `${MOEX_BASE}/engines/stock/markets/shares/boards/${boardId}/securities/${symbol}.json`;
        const response = await axios.get(url, {
          params: {
            'iss.data': 'on',
            'iss.only': 'marketdata',
            'marketdata.columns': 'SECID,LAST,SYSTIME'
          },
          timeout: 8000
        });
        const marketdata = response.data?.marketdata;
        const last = extractMarketdataValue(marketdata, 'LAST');
        if (last === null || last === undefined) {
          results.push({ symbol, status: 'no_last' });
          continue;
        }
        const price = Number(last);
        if (!Number.isFinite(price) || price <= 0) {
          results.push({ symbol, status: 'invalid_last' });
          continue;
        }
        const ts = Date.now();
        await ingestionService.ingest({
          symbol,
          price,
          ts,
          source: 'moex'
        });
        results.push({ symbol, status: 'ok', price });
      } catch (error: any) {
        console.error('MOEX tick sync error', symbol, error?.message || error);
        results.push({ symbol, status: 'error' });
      }
    }

    return res.status(200).json({ synced: results.length, results });
  }
);

export default router;
