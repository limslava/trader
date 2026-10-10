import { Router } from 'express';
import { postgresDatabase } from '../../config/postgres';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await postgresDatabase.query(
    `SELECT id, tenant_id, user_id, action, entity, entity_id, payload, created_at
     FROM audit_logs
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [tenantId]
  );

  return res.status(200).json({ logs: result.rows });
});

export default router;
