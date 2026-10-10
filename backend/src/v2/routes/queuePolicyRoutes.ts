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
  return res.status(200).json({ queue: policy.queue || {} });
});

router.put('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const { lagThreshold, lagCriticalThreshold } = req.body || {};
  if (lagThreshold === undefined && lagCriticalThreshold === undefined) {
    return res.status(400).json({ error: 'Bad Request', message: 'lagThreshold required' });
  }
  const numeric = lagThreshold === undefined ? undefined : Number(lagThreshold);
  const numericCritical = lagCriticalThreshold === undefined ? undefined : Number(lagCriticalThreshold);
  if (numeric !== undefined && (!Number.isFinite(numeric) || numeric < 0)) {
    return res.status(400).json({ error: 'Bad Request', message: 'lagThreshold must be >= 0' });
  }
  if (numericCritical !== undefined && (!Number.isFinite(numericCritical) || numericCritical < 0)) {
    return res.status(400).json({ error: 'Bad Request', message: 'lagCriticalThreshold must be >= 0' });
  }

  const result = await postgresDatabase.query(
    'SELECT policy FROM tenant_policies WHERE tenant_id = $1',
    [tenantId]
  );
  const policy = result.rows[0]?.policy || {};
  const nextPolicy = {
    ...policy,
    queue: {
      ...(policy.queue || {}),
      ...(numeric !== undefined ? { lagThreshold: numeric } : {}),
      ...(numericCritical !== undefined ? { lagCriticalThreshold: numericCritical } : {})
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
     VALUES ($1, $2, 'update', 'queue_policy', $3, $4, NOW())`,
    [tenantId, req.auth!.userId, 'lagThreshold', JSON.stringify({ lagThreshold: numeric, lagCriticalThreshold: numericCritical })]
  );

  return res.status(200).json({ queue: nextPolicy.queue });
});

export default router;
