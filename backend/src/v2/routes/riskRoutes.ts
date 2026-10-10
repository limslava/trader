import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';

const router = Router();

router.post('/pre-trade', authenticateV2, requireRole(['owner', 'admin', 'trader']), async (req: AuthedRequest, res) => {
  const { symbol, side, quantity, price } = req.body || {};

  if (!symbol || !side || !quantity) {
    return res.status(400).json({ error: 'Bad Request', message: 'symbol, side, quantity required' });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid quantity' });
  }

  const px = price === undefined || price === null ? null : Number(price);
  if (px !== null && (!Number.isFinite(px) || px <= 0)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid price' });
  }

  // Stub: minimal checks. Real checks must be portfolio-aware and broker-aware.
  return res.status(200).json({
    allowed: true,
    reasons: [],
    constraints: {
      maxNotional: null,
      maxPositionPercent: null
    }
  });
});

export default router;
