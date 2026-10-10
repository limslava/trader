import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { AnalyticsService } from '../services/AnalyticsService';
import { AIInsightsService } from '../services/AIInsightsService';

const router = Router();
const analytics = new AnalyticsService();
const ai = new AIInsightsService();

router.post('/insights', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const windowMinutes = Number(req.body?.windowMinutes || req.query.windowMinutes || 60);
  const safeWindow = Number.isFinite(windowMinutes) && windowMinutes > 0 ? Math.trunc(windowMinutes) : 60;

  try {
    const snapshot = await analytics.buildSnapshot(tenantId, safeWindow);
    const snapshotId = await analytics.storeSnapshot(tenantId, snapshot.windowMinutes, snapshot);
    const insight = await ai.generateInsights(tenantId, snapshot, snapshotId);
    return res.status(200).json({ snapshotId, insight });
  } catch (error: any) {
    console.error('AI insights error:', error?.response?.data || error);
    return res.status(500).json({ error: 'AI insights failed', message: error?.message || 'AI insights failed' });
  }
});

router.get('/insights', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const limit = Number(req.query.limit || 20);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const rows = await ai.listInsights(tenantId, safeLimit);
  return res.status(200).json({ insights: rows });
});

export default router;
