import { Router } from 'express';
import { postgresDatabase } from '../../config/postgres';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { canUseBrokerEnvironment, isBrokerEnvironment } from '../config/tradingMode';

const router = Router();
const allowedBrokers = new Set(['paper', 'tinkoff', 'sber']);

router.get('/', authenticateV2, async (req: AuthedRequest, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const result = await postgresDatabase.query(
      `SELECT id, tenant_id, broker, account_number, currency, environment, is_active, created_at, updated_at
       FROM broker_accounts
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    return res.status(200).json({ accounts: result.rows });
  } catch (error) {
    console.error('V2 broker accounts list error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Broker accounts fetch failed' });
  }
});

router.post('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { broker, accountNumber, currency, environment } = req.body || {};

  if (!broker || !accountNumber || !currency) {
    return res.status(400).json({ error: 'Bad Request', message: 'broker, accountNumber, currency required' });
  }

  if (!allowedBrokers.has(String(broker))) {
    return res.status(400).json({ error: 'Bad Request', message: 'Unsupported broker' });
  }

  const requestedEnvironment = broker === 'paper' ? 'paper' : (environment || 'sandbox');
  if (!isBrokerEnvironment(requestedEnvironment)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid broker environment' });
  }

  if (!canUseBrokerEnvironment(requestedEnvironment)) {
    return res.status(403).json({ error: 'Forbidden', message: 'Production broker accounts require TRADING_MODE=live and ENABLE_LIVE_TRADING=true' });
  }

  try {
    const tenantId = req.auth!.tenantId;
    const result = await postgresDatabase.query(
      `INSERT INTO broker_accounts
       (tenant_id, broker, account_number, currency, environment, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
       RETURNING id, tenant_id, broker, account_number, currency, environment, is_active, created_at, updated_at`,
      [tenantId, broker, accountNumber, currency, requestedEnvironment]
    );

    return res.status(201).json({ account: result.rows[0] });
  } catch (error) {
    console.error('V2 broker account create error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Broker account create failed' });
  }
});

router.post('/:id/credentials', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { secretRef } = req.body || {};
  if (!secretRef) {
    return res.status(400).json({ error: 'Bad Request', message: 'secretRef required' });
  }

  try {
    const tenantId = req.auth!.tenantId;
    const accountId = req.params.id;

    const accountCheck = await postgresDatabase.query(
      'SELECT id FROM broker_accounts WHERE id = $1 AND tenant_id = $2',
      [accountId, tenantId]
    );

    if (accountCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Broker account not found' });
    }

    const result = await postgresDatabase.query(
      `INSERT INTO broker_credentials (broker_account_id, secret_ref, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id, broker_account_id, secret_ref, created_at`,
      [accountId, secretRef]
    );

    return res.status(201).json({ credential: result.rows[0] });
  } catch (error) {
    console.error('V2 broker credentials error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Broker credentials create failed' });
  }
});

export default router;
