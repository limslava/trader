import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { CryptoErrorRegistry } from '../services/crypto/CryptoErrorRegistry';

const router = Router();
const registry = new CryptoErrorRegistry();

router.get('/:exchange', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const exchange = String(req.params.exchange);
  return res.status(200).json({ map: await registry.list(exchange) });
});

router.post('/:exchange', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const exchange = String(req.params.exchange);
  const { code, message } = req.body || {};
  if (!code || !message) {
    return res.status(400).json({ error: 'Bad Request', message: 'code and message required' });
  }
  await registry.upsert(exchange, String(code), String(message));
  return res.status(201).json({ status: 'updated' });
});

export default router;
