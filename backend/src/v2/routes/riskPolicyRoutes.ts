import { Router } from 'express';
import { postgresDatabase } from '../../config/postgres';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await postgresDatabase.query(
    'SELECT policy FROM tenant_policies WHERE tenant_id = $1',
    [tenantId]
  );
  const policy = result.rows[0]?.policy || {};
  return res.status(200).json({ risk: policy.risk || {} });
});

router.put('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const payload = req.body || {};

  const numericFields = [
    'maxNotional',
    'maxDailyNotional',
    'maxOpenNotional',
    'maxQtyPerOrder',
    'maxOpenOrders',
    'maxDailyOrders',
    'maxOpenQtyPerSymbol',
    'maxOpenNotionalPerSymbol',
    'maxPositionQtyPerSymbol'
  ] as const;

  const nextRisk: Record<string, number | null> = {};
  for (const key of numericFields) {
    if (payload[key] === undefined) continue;
    if (payload[key] === null || payload[key] === '') {
      nextRisk[key] = null;
      continue;
    }
    const numeric = Number(payload[key]);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return res.status(400).json({ error: 'Bad Request', message: `${key} must be >= 0` });
    }
    nextRisk[key] = numeric;
  }

  const result = await postgresDatabase.query(
    'SELECT policy FROM tenant_policies WHERE tenant_id = $1',
    [tenantId]
  );
  const policy = result.rows[0]?.policy || {};
  const nextPolicy = {
    ...policy,
    risk: {
      ...(policy.risk || {}),
      ...nextRisk
    }
  };

  await postgresDatabase.query(
    `INSERT INTO tenant_policies (tenant_id, policy, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (tenant_id)
     DO UPDATE SET policy = EXCLUDED.policy, updated_at = NOW()`,
    [tenantId, JSON.stringify(nextPolicy)]
  );

  await postgresDatabase.query(
    `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload, created_at)
     VALUES ($1, $2, 'update', 'risk_policy', $3, $4, NOW())`,
    [tenantId, req.auth!.userId, 'risk', JSON.stringify(nextRisk)]
  );

  return res.status(200).json({ risk: nextPolicy.risk });
});

export default router;
