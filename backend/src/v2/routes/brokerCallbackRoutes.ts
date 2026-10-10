import { Router } from 'express';
import { ExecutionReconciler } from '../services/ExecutionReconciler';
import { verifyCallbackSecret } from '../middleware/callbackAuth';
import { TinkoffWebhookVerifier } from '../services/TinkoffWebhookVerifier';
import { postgresDatabase } from '../../config/postgres';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';

const router = Router();
const reconciler = new ExecutionReconciler();
const tinkoffVerifier = new TinkoffWebhookVerifier();

const toStringSafe = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const toNumberSafe = (value: any): number | null => {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const pickFirstString = (payload: any, keys: string[]): string | null => {
  for (const key of keys) {
    const value = payload?.[key];
    const text = toStringSafe(value);
    if (text) return text;
  }
  return null;
};

const pickFirstNumber = (payload: any, keys: string[]): number | null => {
  for (const key of keys) {
    const value = payload?.[key];
    const num = toNumberSafe(value);
    if (num !== null) return num;
  }
  return null;
};

const normalizeOrderStatus = (value: any): string | null => {
  const text = toStringSafe(value)?.toLowerCase();
  if (!text) return null;
  if (['accepted', 'filled', 'partially_filled', 'rejected', 'cancelled', 'canceled'].includes(text)) {
    return text === 'canceled' ? 'cancelled' : text;
  }
  return null;
};

const mapStatusToOrderState = (status: string): 'accepted' | 'rejected' | 'filled' | 'partially_filled' | 'cancelled' | null => {
  switch (status) {
    case 'accepted':
    case 'rejected':
    case 'filled':
    case 'partially_filled':
    case 'cancelled':
      return status;
    default:
      return null;
  }
};

const extractCallback = (payload: any) => {
  const orderId = pickFirstString(payload, ['orderId', 'order_id', 'clientOrderId', 'client_order_id', 'id']);
  const brokerTradeId = pickFirstString(payload, ['brokerTradeId', 'broker_trade_id', 'tradeId', 'trade_id']);
  const filledQty = pickFirstNumber(payload, ['filledQty', 'filled_qty', 'quantity', 'qty', 'lots']);
  const price = pickFirstNumber(payload, ['price', 'avgPrice', 'avg_price']);
  const status = normalizeOrderStatus(payload?.status || payload?.orderStatus || payload?.state);
  return { orderId, brokerTradeId, filledQty, price, status };
};

const processCallback = async (
  broker: 'tinkoff' | 'sber',
  req: AuthedRequest,
  res: any,
  options: { verifySignature: boolean; simulated: boolean }
) => {
  const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});
  const signature = req.header('x-tinkoff-signature');
  const secret = process.env.TINKOFF_WEBHOOK_SECRET;

  if (broker === 'tinkoff' && options.verifySignature && secret) {
    if (!signature) {
      await postgresDatabase.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload, created_at)
         VALUES (NULL, NULL, 'callback_rejected', $1, NULL, $2, NOW())`,
        [broker, JSON.stringify({ reason: 'missing_signature', body: req.body || {} })]
      );
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing tinkoff signature' });
    }
    const ok = tinkoffVerifier.verify(rawBody, signature, secret);
    if (!ok) {
      await postgresDatabase.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload, created_at)
         VALUES (NULL, NULL, 'callback_rejected', $1, NULL, $2, NOW())`,
        [broker, JSON.stringify({ reason: 'invalid_signature', signature: signature || null, body: req.body || {} })]
      );
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid tinkoff signature' });
    }
  }

  const normalized = extractCallback(req.body || {});
  if (!normalized.orderId) {
    await postgresDatabase.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload, created_at)
       VALUES (NULL, NULL, 'callback_bad_request', $1, NULL, $2, NOW())`,
      [broker, JSON.stringify({ reason: 'missing_order_id', body: req.body || {} })]
    );
    return res.status(400).json({ error: 'Bad Request', message: 'orderId required' });
  }

  const orderCheck = await postgresDatabase.query(
    'SELECT tenant_id FROM execution_orders WHERE id = $1',
    [normalized.orderId]
  );
  if (orderCheck.rows.length === 0) {
    await postgresDatabase.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload, created_at)
       VALUES (NULL, NULL, 'callback_not_found', $1, $2, $3, NOW())`,
      [broker, normalized.orderId, JSON.stringify({ body: req.body || {} })]
    );
    return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
  }

  const tenantId = orderCheck.rows[0].tenant_id;
  let recorded: 'inserted' | 'duplicate' | 'missing' | null = null;
  if (normalized.filledQty !== null && normalized.price !== null) {
    recorded = await reconciler.recordFill(
      normalized.orderId,
      Number(normalized.filledQty),
      Number(normalized.price),
      normalized.brokerTradeId
    );
    if (recorded !== 'missing') {
      await reconciler.reconcileByFills(normalized.orderId, tenantId);
    }
    if (recorded === 'duplicate') {
      await postgresDatabase.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload, created_at)
         VALUES ($1, NULL, 'callback_duplicate', $2, $3, $4, NOW())`,
        [tenantId, broker, normalized.orderId, JSON.stringify({ body: req.body || {}, brokerTradeId: normalized.brokerTradeId || null })]
      );
    }
  }

  if (normalized.status) {
    const next = mapStatusToOrderState(normalized.status);
    if (next) {
      await reconciler.updateStatus(normalized.orderId, next, tenantId);
    }
  }

  await postgresDatabase.query(
    `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
     VALUES ($1, 'callback', $2, NOW())
     ON CONFLICT (order_id, event_type) DO NOTHING`,
    [normalized.orderId, JSON.stringify({ broker, simulated: options.simulated, ...normalized })]
  );

  await postgresDatabase.query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload, created_at)
     VALUES ($1, NULL, $2, $3, $4, $5, NOW())`,
    [
      tenantId,
      options.simulated ? 'callback_simulated' : 'callback_received',
      broker,
      normalized.orderId,
      JSON.stringify({ body: req.body || {}, signature: signature || null })
    ]
  );

  return res.status(202).json({ status: 'accepted', broker, simulated: options.simulated });
};

// Stub endpoints for broker callbacks
router.post('/tinkoff', verifyCallbackSecret, async (req, res) => {
  return processCallback('tinkoff', req as AuthedRequest, res, { verifySignature: true, simulated: false });
});

router.post('/sber', verifyCallbackSecret, async (req, res) => {
  return processCallback('sber', req as AuthedRequest, res, { verifySignature: false, simulated: false });
});

router.post('/simulate', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const broker = String(req.body?.broker || 'tinkoff').toLowerCase();
  if (broker !== 'tinkoff' && broker !== 'sber') {
    return res.status(400).json({ error: 'Bad Request', message: 'broker must be tinkoff or sber' });
  }
  return processCallback(broker as 'tinkoff' | 'sber', req, res, { verifySignature: false, simulated: true });
});

export default router;
