import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { TinkoffErrorRegistry } from '../services/broker/TinkoffErrorRegistry';
import path from 'path';
import { postgresDatabase } from '../../config/postgres';

const router = Router();
const registry = new TinkoffErrorRegistry();

router.get('/', authenticateV2, requireRole(['owner', 'admin']), async (_req: AuthedRequest, res) => {
  return res.status(200).json({ map: await registry.list() });
});

router.post('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { code, message } = req.body || {};
  if (!code || !message) {
    return res.status(400).json({ error: 'Bad Request', message: 'code and message required' });
  }
  await registry.upsert(String(code), String(message));
  return res.status(201).json({ status: 'updated' });
});

router.post('/seed', authenticateV2, requireRole(['owner', 'admin']), async (_req: AuthedRequest, res) => {
  try {
    const seedFile = process.env.TINKOFF_ERROR_SEED_FILE || 'data/tinkoff_error_map.json';
    const resolved = path.resolve(process.cwd(), seedFile);
    const count = await registry.seedFromFile(resolved);
    return res.status(200).json({ status: 'seeded', count, file: resolved });
  } catch (error: any) {
    console.error('Tinkoff error map seed failed:', error);
    return res.status(500).json({ error: 'Seed failed', message: error?.message || 'Seed failed' });
  }
});

router.post('/backfill', authenticateV2, requireRole(['owner', 'admin']), async (_req: AuthedRequest, res) => {
  try {
    const mappedResult = await postgresDatabase.query(
      `UPDATE execution_order_events e
       SET payload = jsonb_set(e.payload, '{message}', to_jsonb(m.message), true)
       FROM tinkoff_error_map m
       WHERE e.event_type = 'routed'
         AND COALESCE(e.payload->>'message', '') = ''
         AND e.payload->>'errorCode' = m.code`
    );

    const backfillFromOrders = await postgresDatabase.query(
      `WITH latest AS (
         SELECT DISTINCT ON (order_id) order_id, payload
         FROM execution_order_events
         WHERE event_type = 'routed'
         ORDER BY order_id, created_at DESC
       )
       UPDATE execution_orders eo
       SET last_error = COALESCE(latest.payload->>'message', eo.last_error),
           updated_at = NOW()
       FROM latest
       WHERE eo.id = latest.order_id
         AND (eo.last_error IS NULL OR eo.last_error = '')`
    );

    const fillUnknown = await postgresDatabase.query(
      `UPDATE execution_order_events e
       SET payload = jsonb_set(
         e.payload,
         '{message}',
         to_jsonb(COALESCE(eo.last_error, 'Unknown broker rejection')),
         true
       )
       FROM execution_orders eo
       WHERE e.order_id = eo.id
         AND e.event_type = 'routed'
         AND COALESCE(e.payload->>'message', '') IN ('', 'unknown')`
    );

    return res.status(200).json({
      status: 'backfilled',
      routedUpdated: mappedResult.rowCount || 0,
      ordersUpdated: backfillFromOrders.rowCount || 0,
      unknownUpdated: fillUnknown.rowCount || 0
    });
  } catch (error: any) {
    console.error('Tinkoff error map backfill failed:', error);
    return res.status(500).json({ error: 'Backfill failed', message: error?.message || 'Backfill failed' });
  }
});

export default router;
