import { Router } from 'express';
import { postgresDatabase } from '../../config/postgres';
import { RiskService } from '../services/RiskService';
import { ExecutionPipeline } from '../services/ExecutionPipeline';
import { OrderStateMachine } from '../services/OrderStateMachine';
import { BrokerExecutionService } from '../services/broker/BrokerExecutionService';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';

const router = Router();

const allowedSides = new Set(['buy', 'sell']);
const allowedTypes = new Set(['market', 'limit', 'stop', 'stop_limit']);
const riskService = new RiskService();
const pipeline = new ExecutionPipeline();
const brokerExecution = new BrokerExecutionService();
const stateMachine = new OrderStateMachine();

router.post('/', authenticateV2, requireRole(['owner', 'admin', 'trader']), async (req: AuthedRequest, res) => {
  const { symbol, side, type, quantity, price, accountId, async } = req.body || {};

  if (!symbol || !side || !type || !quantity || !accountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'symbol, side, type, quantity, accountId required' });
  }

  if (!allowedSides.has(side)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid order side' });
  }

  if (!allowedTypes.has(type)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid order type' });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid quantity' });
  }

  const orderPrice = price === undefined || price === null ? null : Number(price);
  if (orderPrice !== null && (!Number.isFinite(orderPrice) || orderPrice <= 0)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid price' });
  }

  try {
    const tenantId = req.auth!.tenantId;
    const accountCheck = await postgresDatabase.query(
      'SELECT id FROM broker_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE',
      [accountId, tenantId]
    );

    if (accountCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Broker account not found' });
    }

    const riskCheck = await riskService.preTradeCheck({
      symbol: symbol.toUpperCase(),
      side,
      quantity: qty,
      price: orderPrice,
      tenantId
    });

    if (!riskCheck.allowed) {
      return res.status(409).json({ error: 'Risk Rejected', reasons: riskCheck.reasons });
    }

    const result = await postgresDatabase.query(
      `INSERT INTO execution_orders
       (tenant_id, broker_account_id, symbol, side, order_type, quantity, price, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', NOW(), NOW())
       RETURNING id, tenant_id, broker_account_id, symbol, side, order_type, quantity, price, status, created_at, updated_at`,
      [tenantId, accountId || null, symbol.toUpperCase(), side, type, qty, orderPrice]
    );

    const order = result.rows[0];

    await postgresDatabase.query(
      `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
       VALUES ($1, 'created', $2, NOW())`,
      [order.id, JSON.stringify({ source: 'api', status: 'new' })]
    );

    if (async === true) {
      await pipeline.enqueue(order.id);
      return res.status(202).json({ order: { ...order, status: 'queued' } });
    }

    const brokerResponse = await brokerExecution.placeOrder(tenantId, accountId, {
      symbol: symbol.toUpperCase(),
      side,
      type,
      quantity: qty,
      price: orderPrice,
      clientOrderId: order.id
    });

    if (brokerResponse.status === 'rejected' && brokerResponse.message === 'Missing broker credential') {
      if (stateMachine.canTransition(order.status, 'rejected')) {
        await postgresDatabase.query(
          `UPDATE execution_orders SET status = $1, updated_at = NOW() WHERE id = $2`,
          ['rejected', order.id]
        );
        await postgresDatabase.query(
          `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
           VALUES ($1, 'rejected', $2, NOW())`,
          [order.id, JSON.stringify({ reason: 'missing_credential' })]
        );
      }
      return res.status(409).json({ error: 'Missing Credentials', message: brokerResponse.message });
    }

    const routedMessage = brokerResponse.status === 'rejected'
      ? (brokerResponse.message || 'Unknown broker rejection')
      : brokerResponse.message || null;

    await postgresDatabase.query(
      `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
       VALUES ($1, 'routed', $2, NOW())`,
      [order.id, JSON.stringify({
        brokerOrderId: brokerResponse.brokerOrderId,
        status: brokerResponse.status,
        message: routedMessage,
        errorCode: brokerResponse.errorCode || null
      })]
    );

    const finalStatus = brokerResponse.status === 'accepted' ? 'accepted' : 'rejected';
    if (stateMachine.canTransition(order.status, finalStatus)) {
      await postgresDatabase.query(
        `UPDATE execution_orders
         SET status = $1,
             broker_order_id = $2,
             last_error = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [finalStatus, brokerResponse.brokerOrderId || null, routedMessage, order.id]
      );
    }

    return res.status(201).json({ order: { ...order, status: finalStatus }, broker: brokerResponse });
  } catch (error) {
    console.error('V2 order create error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Order create failed' });
  }
});

router.post('/:id/queue', authenticateV2, requireRole(['owner', 'admin', 'trader']), async (req: AuthedRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = req.params.id;
    if (!orderId) {
      return res.status(400).json({ error: 'Bad Request', message: 'order id required' });
    }

    const orderResult = await postgresDatabase.query(
      'SELECT id FROM execution_orders WHERE id = $1 AND tenant_id = $2',
      [orderId, tenantId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }

    await pipeline.enqueue(orderId);
    return res.status(202).json({ status: 'queued', orderId });
  } catch (error) {
    console.error('V2 order queue error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Order queue failed' });
  }
});

router.get('/', authenticateV2, async (req: AuthedRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const result = await postgresDatabase.query(
      `SELECT id, tenant_id, broker_account_id, symbol, side, order_type, quantity, price, status, created_at, updated_at
       FROM execution_orders
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [tenantId]
    );
    return res.status(200).json({ orders: result.rows });
  } catch (error) {
    console.error('V2 orders list error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Orders list failed' });
  }
});

router.get('/:id', authenticateV2, async (req: AuthedRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = req.params.id;
    const result = await postgresDatabase.query(
      `SELECT id, tenant_id, broker_account_id, symbol, side, order_type, quantity, price, status, created_at, updated_at
       FROM execution_orders
       WHERE id = $1 AND tenant_id = $2`,
      [orderId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }

    return res.status(200).json({ order: result.rows[0] });
  } catch (error) {
    console.error('V2 order get error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Order fetch failed' });
  }
});

router.get('/:id/events', authenticateV2, async (req: AuthedRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = req.params.id;

    const orderResult = await postgresDatabase.query(
      'SELECT id FROM execution_orders WHERE id = $1 AND tenant_id = $2',
      [orderId, tenantId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
    }

    const eventsResult = await postgresDatabase.query(
      `SELECT id, order_id, event_type, payload, created_at
       FROM execution_order_events
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId]
    );

    return res.status(200).json({ events: eventsResult.rows });
  } catch (error) {
    console.error('V2 order events error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Order events failed' });
  }
});

export default router;
