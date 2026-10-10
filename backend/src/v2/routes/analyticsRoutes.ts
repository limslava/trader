import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { AnalyticsService } from '../services/AnalyticsService';

const router = Router();
const analytics = new AnalyticsService();

router.get('/snapshot', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const windowMinutes = Number(req.query.windowMinutes || 60);
  const tenantId = req.auth!.tenantId;

  try {
    const snapshot = await analytics.buildSnapshot(tenantId, windowMinutes);
    const id = await analytics.storeSnapshot(tenantId, snapshot.windowMinutes, snapshot);
    return res.status(200).json({ id, snapshot });
  } catch (error) {
    console.error('Analytics snapshot error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Analytics snapshot failed' });
  }
});

router.get('/snapshots', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const limit = Number(req.query.limit || 20);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const rows = await analytics.listSnapshots(tenantId, safeLimit);
  return res.status(200).json({ snapshots: rows });
});

export default router;
