import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { postgresDatabase } from '../../config/postgres';
import { authenticateV2, AuthedRequest } from '../middleware/auth';
import { simpleRateLimit } from '../middleware/rateLimit';
import { getJwtSecret } from '../config/authConfig';

const router = Router();
const authRateLimit = simpleRateLimit((req) => `auth:${req.ip || 'unknown'}`, 20, 15 * 60_000);

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 120);
};

router.post('/register', authRateLimit, async (req, res) => {
  const { email, username, password, tenantName, tenantSlug } = req.body || {};

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'email, username, password required' });
  }

  try {
    const existingUser = await postgresDatabase.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Conflict', message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userResult = await postgresDatabase.query(
      `INSERT INTO users (email, username, password_hash, profile, preferences, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, email, username, profile, preferences, created_at, updated_at`,
      [
        email,
        username,
        hashedPassword,
        JSON.stringify({}),
        JSON.stringify({ theme: 'LIGHT', language: 'RU' })
      ]
    );

    const user = userResult.rows[0];

    let tenantId: string | null = null;
    let role = 'owner';

    if (tenantSlug || tenantName) {
      const slug = tenantSlug ? slugify(tenantSlug) : slugify(tenantName);
      if (!slug) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid tenant slug' });
      }
      const existingTenant = await postgresDatabase.query(
        'SELECT id FROM tenants WHERE slug = $1',
        [slug]
      );

      if (existingTenant.rows.length > 0) {
        return res.status(409).json({ error: 'Conflict', message: 'Tenant slug already exists' });
      }

      const tenantResult = await postgresDatabase.query(
        `INSERT INTO tenants (name, slug, status, created_at, updated_at)
         VALUES ($1, $2, 'active', NOW(), NOW())
         RETURNING id`,
        [tenantName || slug, slug]
      );
      tenantId = tenantResult.rows[0].id;
    } else {
      const baseSlug = slugify(username) || `user-${user.id}`;
      const personalSlug = `${baseSlug}-${user.id}`;
      const tenantResult = await postgresDatabase.query(
        `INSERT INTO tenants (name, slug, status, created_at, updated_at)
         VALUES ($1, $2, 'active', NOW(), NOW())
         RETURNING id`,
        [`${username} workspace`, personalSlug]
      );
      tenantId = tenantResult.rows[0].id;
    }

    await postgresDatabase.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [tenantId, user.id, role]
    );

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        tenantId,
        role
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        profile: user.profile,
        preferences: user.preferences
      },
      tenantId,
      role,
      token
    });
  } catch (error) {
    console.error('V2 register error:', error);
    const message = String(error);
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'PostgreSQL is unavailable' });
    }
    return res.status(500).json({ error: 'Internal Error', message: 'Registration failed' });
  }
});

router.post('/login', authRateLimit, async (req, res) => {
  const { email, password, tenantSlug } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'email and password required' });
  }

  try {
    const userResult = await postgresDatabase.query(
      'SELECT id, email, username, password_hash, profile, preferences FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const tenantResult = tenantSlug
      ? await postgresDatabase.query('SELECT id FROM tenants WHERE slug = $1', [slugify(tenantSlug)])
      : await postgresDatabase.query(
        `SELECT t.id
         FROM tenants t
         JOIN tenant_members tm ON tm.tenant_id = t.id
         WHERE tm.user_id = $1
         ORDER BY tm.created_at ASC
         LIMIT 1`,
        [user.id]
      );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Tenant not found' });
    }

    const tenantId = tenantResult.rows[0].id;
    const membership = await postgresDatabase.query(
      'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Forbidden', message: 'User not in tenant' });
    }

    const role = membership.rows[0].role;
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        tenantId,
        role
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        profile: user.profile,
        preferences: user.preferences
      },
      tenantId,
      role,
      token
    });
  } catch (error) {
    console.error('V2 login error:', error);
    const message = String(error);
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'PostgreSQL is unavailable' });
    }
    return res.status(500).json({ error: 'Internal Error', message: 'Login failed' });
  }
});

router.get('/profile', authenticateV2, async (req: AuthedRequest, res) => {
  try {
    const auth = req.auth!;
    const userResult = await postgresDatabase.query(
      'SELECT id, email, username, profile, preferences FROM users WHERE id = $1',
      [auth.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const tenantResult = await postgresDatabase.query(
      'SELECT id, name, slug, status FROM tenants WHERE id = $1',
      [auth.tenantId]
    );

    return res.status(200).json({
      user: userResult.rows[0],
      tenant: tenantResult.rows[0] || null,
      role: auth.role
    });
  } catch (error) {
    console.error('V2 profile error:', error);
    const message = String(error);
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'PostgreSQL is unavailable' });
    }
    return res.status(500).json({ error: 'Internal Error', message: 'Profile failed' });
  }
});

export default router;
