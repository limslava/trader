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

  return res.status(200).json({ policy: result.rows[0]?.policy || {} });
});

router.put('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const policy = req.body?.policy || {};

  await postgresDatabase.query(
    `INSERT INTO tenant_policies (tenant_id, policy, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (tenant_id)
     DO UPDATE SET policy = EXCLUDED.policy, updated_at = NOW()`,
    [tenantId, JSON.stringify(policy)]
  );

  return res.status(200).json({ policy });
});

export default router;
