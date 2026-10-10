import { Router } from 'express';
import { postgresDatabase } from '../../config/postgres';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateV2, async (_req: AuthedRequest, res) => {
  const result = await postgresDatabase.query(
    `SELECT id, exchange, symbol, name, lot_size, tick_size, currency, instrument_id, created_at, updated_at
     FROM instruments
     ORDER BY exchange, symbol`
  );

  return res.status(200).json({ instruments: result.rows });
});

router.post('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { exchange, symbol, name, lotSize, tickSize, currency, instrumentId } = req.body || {};

  if (!exchange || !symbol) {
    return res.status(400).json({ error: 'Bad Request', message: 'exchange and symbol required' });
  }

  const result = await postgresDatabase.query(
    `INSERT INTO instruments (exchange, symbol, name, lot_size, tick_size, currency, instrument_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (exchange, symbol)
     DO UPDATE SET name = EXCLUDED.name,
                   lot_size = EXCLUDED.lot_size,
                   tick_size = EXCLUDED.tick_size,
                   currency = EXCLUDED.currency,
                   instrument_id = EXCLUDED.instrument_id,
                   updated_at = NOW()
     RETURNING id, exchange, symbol, name, lot_size, tick_size, currency, instrument_id, created_at, updated_at`,
    [
      String(exchange),
      String(symbol).toUpperCase(),
      name || null,
      lotSize || 1,
      tickSize || 0.01,
      currency || 'RUB',
      instrumentId || null
    ]
  );

  return res.status(201).json({ instrument: result.rows[0] });
});

export default router;
