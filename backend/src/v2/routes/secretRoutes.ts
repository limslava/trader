import { Router } from 'express';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { secretStore } from '../services/secrets/SecretStore';
import { SecretRegistry } from '../services/secrets/SecretRegistry';
import { SecretAuditLog } from '../services/secrets/SecretAuditLog';

const router = Router();
const registry = new SecretRegistry();
const audit = new SecretAuditLog();

router.post('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { secret, brokerAccountId } = req.body || {};
  if (!secret || !brokerAccountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'secret and brokerAccountId required' });
  }

  const tenantId = req.auth!.tenantId;
  try {
    const ref = await secretStore.put(tenantId, secret);
    await registry.register(tenantId, brokerAccountId, ref);
    await audit.record(tenantId, req.auth!.userId, 'secret_put', ref);
    return res.status(201).json({ ref });
  } catch (error: any) {
    const message = String(error?.message || error);
    if (message.includes('Broker account not found')) {
      return res.status(404).json({ error: 'Not Found', message: 'Broker account not found' });
    }
    console.error('Secret put error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Secret put failed' });
  }
});

router.post('/rotate', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { secret, brokerAccountId } = req.body || {};
  if (!secret || !brokerAccountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'secret and brokerAccountId required' });
  }

  const tenantId = req.auth!.tenantId;
  try {
    const ref = await secretStore.put(tenantId, secret);
    await registry.register(tenantId, brokerAccountId, ref);
    await audit.record(tenantId, req.auth!.userId, 'secret_rotate', ref);
    return res.status(201).json({ ref });
  } catch (error: any) {
    const message = String(error?.message || error);
    if (message.includes('Broker account not found')) {
      return res.status(404).json({ error: 'Not Found', message: 'Broker account not found' });
    }
    console.error('Secret rotate error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Secret rotate failed' });
  }
});

router.post('/revoke', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { brokerAccountId } = req.body || {};
  if (!brokerAccountId) {
    return res.status(400).json({ error: 'Bad Request', message: 'brokerAccountId required' });
  }

  const tenantId = req.auth!.tenantId;
  await registry.revoke(tenantId, brokerAccountId);
  await audit.record(tenantId, req.auth!.userId, 'secret_revoke', brokerAccountId);

  return res.status(200).json({ status: 'revoked' });
});

export default router;
