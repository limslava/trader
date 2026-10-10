import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { postgresDatabase } from '../../config/postgres';
import { ExecutionReconciler } from '../services/ExecutionReconciler';

const router = Router();
const reconciler = new ExecutionReconciler();

router.post('/fills', authenticateV2, requireRole(['owner', 'admin', 'trader']), async (req: AuthedRequest, res) => {
  const { orderId, filledQty, price, brokerTradeId } = req.body || {};

  if (!orderId || !filledQty || !price) {
    return res.status(400).json({ error: 'Bad Request', message: 'orderId, filledQty, price required' });
  }

  const qty = Number(filledQty);
  const px = Number(price);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid fill data' });
  }

  const orderCheck = await postgresDatabase.query(
    'SELECT id, tenant_id FROM execution_orders WHERE id = $1',
    [orderId]
  );

  if (orderCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
  }

  const orderTenantId = orderCheck.rows[0].tenant_id;
  if (orderTenantId !== req.auth!.tenantId) {
    return res.status(403).json({ error: 'Forbidden', message: 'Order not in tenant' });
  }

  const recorded = await reconciler.recordFill(orderId, qty, px, brokerTradeId);
  if (recorded === 'missing') {
    return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
  }
  const reconciled = await reconciler.reconcileByFills(orderId, req.auth!.tenantId);

  return res.status(200).json({ status: reconciled || 'no_change' });
});

export default router;
