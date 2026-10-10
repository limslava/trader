import { Router } from 'express';
import crypto from 'crypto';
import { postgresDatabase } from '../../config/postgres';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';
import { TenantInvitationMailer } from '../services/TenantInvitationMailer';

const router = Router();
const mailer = new TenantInvitationMailer();

router.get('/', authenticateV2, async (req: AuthedRequest, res) => {
  const userId = req.auth!.userId;
  const result = await postgresDatabase.query(
    `SELECT t.id, t.name, t.slug, t.status, tm.role
     FROM tenants t
     JOIN tenant_members tm ON tm.tenant_id = t.id
     WHERE tm.user_id = $1`,
    [userId]
  );

  return res.status(200).json({ tenants: result.rows });
});

router.post('/', authenticateV2, async (req: AuthedRequest, res) => {
  const { name, slug } = req.body || {};
  if (!name || !slug) {
    return res.status(400).json({ error: 'Bad Request', message: 'name and slug required' });
  }

  const tenant = await postgresDatabase.query(
    `INSERT INTO tenants (name, slug, status, created_at, updated_at)
     VALUES ($1, $2, 'active', NOW(), NOW())
     RETURNING id, name, slug, status`,
    [name, slug]
  );

  await postgresDatabase.query(
    `INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
     VALUES ($1, $2, 'owner', NOW())
     ON CONFLICT DO NOTHING`,
    [tenant.rows[0].id, req.auth!.userId]
  );

  return res.status(201).json({ tenant: tenant.rows[0] });
});

router.patch('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { name, status } = req.body || {};
  if (!name && !status) {
    return res.status(400).json({ error: 'Bad Request', message: 'name or status required' });
  }

  const tenantId = req.auth!.tenantId;
  const result = await postgresDatabase.query(
    `UPDATE tenants SET
       name = COALESCE($1, name),
       status = COALESCE($2, status),
       updated_at = NOW()
     WHERE id = $3
     RETURNING id, name, slug, status`,
    [name || null, status || null, tenantId]
  );

  return res.status(200).json({ tenant: result.rows[0] });
});

router.delete('/', authenticateV2, requireRole(['owner']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  await postgresDatabase.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  return res.status(200).json({ status: 'deleted' });
});

router.get('/members', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await postgresDatabase.query(
    `SELECT u.id, u.email, u.username, tm.role
     FROM tenant_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.tenant_id = $1`,
    [tenantId]
  );

  return res.status(200).json({ members: result.rows });
});

router.post('/invitations', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { email, role } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Bad Request', message: 'email required' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const tenantId = req.auth!.tenantId;

  const invite = await postgresDatabase.query(
    `INSERT INTO tenant_invitations (tenant_id, email, role, token, status, created_at)
     VALUES ($1, $2, $3, $4, 'pending', NOW())
     RETURNING id, email, role, token, status`,
    [tenantId, email, role || 'viewer', token]
  );

  await mailer.send(email, token);

  return res.status(201).json({ invitation: invite.rows[0] });
});

router.post('/invitations/revoke', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'Bad Request', message: 'token required' });
  }

  const tenantId = req.auth!.tenantId;
  const inviteResult = await postgresDatabase.query(
    `SELECT id, tenant_id, status
     FROM tenant_invitations
     WHERE token = $1`,
    [token]
  );

  if (inviteResult.rows.length === 0) {
    return res.status(404).json({ error: 'Not Found', message: 'Invitation not found' });
  }

  const invite = inviteResult.rows[0];
  if (invite.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Forbidden', message: 'Invitation not in tenant' });
  }

  if (invite.status !== 'pending') {
    return res.status(409).json({ error: 'Conflict', message: 'Invitation already processed' });
  }

  await postgresDatabase.query(`UPDATE tenant_invitations SET status = 'revoked' WHERE id = $1`, [invite.id]);

  return res.status(200).json({ status: 'revoked' });
});

router.post('/invitations/accept', authenticateV2, async (req: AuthedRequest, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'Bad Request', message: 'token required' });
  }

  const inviteResult = await postgresDatabase.query(
    `SELECT id, tenant_id, role, email, status
     FROM tenant_invitations
     WHERE token = $1`,
    [token]
  );

  if (inviteResult.rows.length === 0) {
    return res.status(404).json({ error: 'Not Found', message: 'Invitation not found' });
  }

  const invite = inviteResult.rows[0];
  if (invite.status !== 'pending') {
    return res.status(409).json({ error: 'Conflict', message: 'Invitation already used' });
  }

  if (String(invite.email).toLowerCase() !== String(req.auth!.email).toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden', message: 'Invitation email does not match user' });
  }

  await postgresDatabase.query(
    `INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT DO NOTHING`,
    [invite.tenant_id, req.auth!.userId, invite.role]
  );

  await postgresDatabase.query(
    `UPDATE tenant_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
    [invite.id]
  );

  return res.status(200).json({ status: 'accepted' });
});

export default router;
