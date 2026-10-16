import crypto from 'node:crypto';
import { Router, type Request, type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import QRCode from 'qrcode';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { z } from 'zod';
import { config, isProd } from './config.js';
import { pool } from './db.js';
import { HttpError } from './http.js';

/**
 * Single-owner auth with three layers, mirroring the password manager:
 *  1. app password (APP_PASSWORD),
 *  2. optional TOTP code from an authenticator app (required once enabled),
 *  3. passkeys (Face ID / Touch ID) — a registered passkey signs in on its own, since it already proves
 *     possession of the device plus biometrics.
 * Sensitive changes (enabling/disabling 2FA, adding a passkey) ask for the password again.
 */

const COOKIE = 'trader_session';
// Short sliding session: the app keeps it alive while on screen; a killed or backgrounded app is locked
// by the next open, and the user signs in again with Face ID or the password.
const SESSION_TTL_SEC = 3 * 60;
const REFRESH_AFTER_SEC = 30;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

function passwordMatches(input: string): boolean {
  // Compare fixed-length digests so timingSafeEqual works regardless of input length.
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(config.APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// --- Rate limit per IP + account lock after repeated failures ---

const failures = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string) {
  const entry = failures.get(ip);
  if (entry && entry.resetAt > Date.now() && entry.count >= 10) {
    throw new HttpError(429, 'Слишком много попыток входа, попробуйте позже');
  }
}
function recordFailure(ip: string) {
  for (const [k, v] of failures) if (v.resetAt <= Date.now()) failures.delete(k);
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= Date.now()) failures.set(ip, { count: 1, resetAt: Date.now() + 15 * 60_000 });
  else entry.count++;
}

type Settings = { totp_secret_enc: string | null; totp_enabled: boolean; totp_last_step: string; failed_logins: number; locked_until: Date | null };

async function settings(): Promise<Settings> {
  const { rows } = await pool.query<Settings>('SELECT * FROM auth_settings WHERE id = 1');
  return rows[0];
}

async function assertNotLocked(s: Settings) {
  if (s.locked_until && s.locked_until.getTime() > Date.now()) {
    const min = Math.ceil((s.locked_until.getTime() - Date.now()) / 60_000);
    throw new HttpError(423, `Вход заблокирован после неудачных попыток, подождите ${min} мин`);
  }
}

async function accountFailure(req: Request, event: string) {
  recordFailure(req.ip ?? 'unknown');
  await pool.query(
    `UPDATE auth_settings SET failed_logins = failed_logins + 1,
       locked_until = CASE WHEN failed_logins + 1 >= $1 THEN now() + make_interval(mins => $2) ELSE locked_until END WHERE id = 1`,
    [MAX_FAILURES, LOCK_MINUTES],
  );
  await log(req, event);
}

async function accountSuccess(req: Request, event: string) {
  failures.delete(req.ip ?? 'unknown');
  await pool.query('UPDATE auth_settings SET failed_logins = 0, locked_until = NULL WHERE id = 1');
  await log(req, event);
}

function log(req: Request, event: string) {
  return pool.query('INSERT INTO auth_log (event, ip, user_agent) VALUES ($1, $2, $3)', [event, req.ip ?? null, (req.headers['user-agent'] ?? '').slice(0, 200)]);
}

// --- Server-side encryption of the TOTP secret ---

const encKey = () => crypto.createHmac('sha256', config.JWT_SECRET).update('totp-secret').digest();

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Accepts the code once per 30-second step (no replay), with one step of clock tolerance. */
async function checkTotp(s: Settings, code: string | undefined): Promise<boolean> {
  if (!s.totp_secret_enc) return false;
  const token = (code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(token)) return false;
  const result = await verifyTotp({ secret: decrypt(s.totp_secret_enc), token, epochTolerance: 30 });
  if (!result.valid) return false;
  const step = Math.floor(Date.now() / 30_000) + (result.delta ?? 0);
  const { rowCount } = await pool.query('UPDATE auth_settings SET totp_last_step = $1 WHERE id = 1 AND totp_last_step < $1', [step]);
  return (rowCount ?? 0) > 0;
}

// --- Sessions ---

/** Derived from the password too, so changing APP_PASSWORD logs every device out. */
function sessionSecret(): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(config.APP_PASSWORD).digest('hex');
}

function issueSession(res: import('express').Response, method: string) {
  const token = jwt.sign({ sub: 'owner', via: method }, sessionSecret(), { algorithm: 'HS256', expiresIn: SESSION_TTL_SEC });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: SESSION_TTL_SEC * 1000 });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Требуется вход');
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, sessionSecret(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, 'Сессия истекла, войдите снова');
  }
  // Sliding expiry: any request from an open app extends the session.
  if (payload.iat && Date.now() / 1000 - payload.iat > REFRESH_AFTER_SEC) issueSession(res, String(payload.via ?? 'password'));
  next();
};

// --- Routes ---

export const authRouter = Router();

/** Public: tells the login screen whether to ask for a code and whether Face ID is available. */
authRouter.get('/status', async (_req, res) => {
  const s = await settings();
  const { rows } = await pool.query<{ n: string }>('SELECT count(*) AS n FROM passkeys');
  res.json({ totpEnabled: s.totp_enabled, passkeys: Number(rows[0].n), rpId: config.WEBAUTHN_RP_ID });
});

authRouter.post('/login', async (req, res) => {
  checkRateLimit(req.ip ?? 'unknown');
  const { password, code } = z.object({ password: z.string(), code: z.string().optional() }).parse(req.body);
  const s = await settings();
  await assertNotLocked(s);
  if (!passwordMatches(password)) {
    await accountFailure(req, 'login_fail_password');
    throw new HttpError(401, 'Неверный пароль');
  }
  if (s.totp_enabled) {
    if (!code) throw new HttpError(428, 'Введите код из приложения-аутентификатора');
    if (!(await checkTotp(s, code))) {
      await accountFailure(req, 'login_fail_totp');
      throw new HttpError(401, 'Неверный или уже использованный код');
    }
  }
  await accountSuccess(req, 'login_ok');
  issueSession(res, s.totp_enabled ? 'password+totp' : 'password');
  res.json({ ok: true });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

// --- 2FA (TOTP) ---

/** Step 1: a fresh secret and a QR for the authenticator app; nothing is enabled until a code confirms it. */
authRouter.post('/2fa/setup', requireAuth, async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  if (!passwordMatches(password)) throw new HttpError(401, 'Неверный пароль');
  const s = await settings();
  if (s.totp_enabled) throw new HttpError(409, 'Двухфакторная защита уже включена');
  // Reuse a pending secret: the page may reload while the user switches to the authenticator app,
  // and a fresh secret would silently invalidate what they just scanned.
  const secret = s.totp_secret_enc ? decrypt(s.totp_secret_enc) : generateSecret();
  if (!s.totp_secret_enc) await pool.query('UPDATE auth_settings SET totp_secret_enc = $1, totp_last_step = 0 WHERE id = 1', [encrypt(secret)]);
  const uri = generateURI({ issuer: 'Trader', label: config.WEBAUTHN_RP_ID, secret });
  res.json({ secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
});

authRouter.post('/2fa/enable', requireAuth, async (req, res) => {
  const { code } = z.object({ code: z.string() }).parse(req.body);
  const s = await settings();
  if (!s.totp_secret_enc) throw new HttpError(409, 'Сначала получите QR-код');
  if (!(await checkTotp(s, code))) {
    await log(req, 'totp_enable_fail');
    throw new HttpError(401, 'Код не подошёл. Если QR сканировали давно, нажмите «Начать заново» и добавьте ключ в приложение ещё раз');
  }
  await pool.query('UPDATE auth_settings SET totp_enabled = true WHERE id = 1');
  await log(req, 'totp_enabled');
  res.json({ ok: true });
});

/** Drops a pending (not yet confirmed) secret so the next setup shows a fresh QR. */
authRouter.post('/2fa/reset', requireAuth, async (req, res) => {
  const s = await settings();
  if (s.totp_enabled) throw new HttpError(409, 'Сначала отключите двухфакторную защиту');
  await pool.query('UPDATE auth_settings SET totp_secret_enc = NULL, totp_last_step = 0 WHERE id = 1');
  await log(req, 'totp_reset');
  res.json({ ok: true });
});

authRouter.post('/2fa/disable', requireAuth, async (req, res) => {
  const { password, code } = z.object({ password: z.string(), code: z.string() }).parse(req.body);
  if (!passwordMatches(password)) throw new HttpError(401, 'Неверный пароль');
  const s = await settings();
  if (!s.totp_enabled) throw new HttpError(409, 'Двухфакторная защита не включена');
  if (!(await checkTotp(s, code))) throw new HttpError(401, 'Неверный код');
  await pool.query('UPDATE auth_settings SET totp_enabled = false, totp_secret_enc = NULL WHERE id = 1');
  await log(req, 'totp_disabled');
  res.json({ ok: true });
});

// --- Passkeys (WebAuthn) ---

type PasskeyRow = { id: number; credential_id: string; public_key: Buffer; counter: string; transports: string[]; name: string; created_at: Date; last_used_at: Date | null };

const origins = config.WEBAUTHN_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
const USER_ID = new TextEncoder().encode('owner');

// Challenges live a few minutes in memory; one process serves one owner, so this is enough.
const challenges = new Map<string, { value: string; expires: number }>();
function putChallenge(kind: string, value: string) {
  challenges.set(kind, { value, expires: Date.now() + 5 * 60_000 });
}
function takeChallenge(kind: string): string {
  const c = challenges.get(kind);
  challenges.delete(kind);
  if (!c || c.expires < Date.now()) throw new HttpError(400, 'Запрос устарел, попробуйте ещё раз');
  return c.value;
}

authRouter.get('/passkeys', requireAuth, async (_req, res) => {
  const { rows } = await pool.query<PasskeyRow>('SELECT * FROM passkeys ORDER BY created_at');
  res.json(rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at.toISOString(), lastUsedAt: r.last_used_at?.toISOString() ?? null })));
});

authRouter.post('/passkeys/register/options', requireAuth, async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  if (!passwordMatches(password)) throw new HttpError(401, 'Неверный пароль');
  const { rows } = await pool.query<PasskeyRow>('SELECT credential_id, transports FROM passkeys');
  const options = await generateRegistrationOptions({
    rpName: 'Trader',
    rpID: config.WEBAUTHN_RP_ID,
    userName: 'owner',
    userID: USER_ID,
    userDisplayName: 'Владелец',
    attestationType: 'none',
    excludeCredentials: rows.map((r) => ({ id: r.credential_id, transports: r.transports as never })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
  });
  putChallenge('register', options.challenge);
  res.json(options);
});

authRouter.post('/passkeys/register/verify', requireAuth, async (req, res) => {
  const { name, response } = z.object({ name: z.string().min(1).max(60), response: z.unknown() }).parse(req.body);
  const verification = await verifyRegistrationResponse({
    response: response as RegistrationResponseJSON,
    expectedChallenge: takeChallenge('register'),
    expectedOrigin: origins,
    expectedRPID: config.WEBAUTHN_RP_ID,
    requireUserVerification: true,
  }).catch((err) => {
    throw new HttpError(400, `Passkey не подтверждён: ${err instanceof Error ? err.message : String(err)}`);
  });
  if (!verification.verified || !verification.registrationInfo) throw new HttpError(400, 'Passkey не подтверждён');
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await pool.query(
    'INSERT INTO passkeys (credential_id, public_key, counter, transports, device_type, backed_up, name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [credential.id, Buffer.from(credential.publicKey), credential.counter, credential.transports ?? [], credentialDeviceType, credentialBackedUp, name],
  );
  await log(req, 'passkey_added');
  res.json({ ok: true });
});

authRouter.delete('/passkeys/:id', requireAuth, async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body ?? {});
  if (!passwordMatches(password)) throw new HttpError(401, 'Неверный пароль');
  await pool.query('DELETE FROM passkeys WHERE id = $1', [z.coerce.number().int().parse(req.params.id)]);
  await log(req, 'passkey_removed');
  res.json({ ok: true });
});

/** Public: start a passkey sign-in. */
authRouter.post('/passkeys/login/options', async (req, res) => {
  checkRateLimit(req.ip ?? 'unknown');
  const s = await settings();
  await assertNotLocked(s);
  const { rows } = await pool.query<PasskeyRow>('SELECT credential_id, transports FROM passkeys');
  if (rows.length === 0) throw new HttpError(404, 'Passkey ещё не настроен');
  const options = await generateAuthenticationOptions({
    rpID: config.WEBAUTHN_RP_ID,
    userVerification: 'required',
    allowCredentials: rows.map((r) => ({ id: r.credential_id, transports: r.transports as never })),
  });
  putChallenge('login', options.challenge);
  res.json(options);
});

authRouter.post('/passkeys/login/verify', async (req, res) => {
  checkRateLimit(req.ip ?? 'unknown');
  const response = req.body as AuthenticationResponseJSON;
  const { rows } = await pool.query<PasskeyRow>('SELECT * FROM passkeys WHERE credential_id = $1', [response?.id ?? '']);
  const row = rows[0];
  if (!row) {
    await accountFailure(req, 'login_fail_passkey');
    throw new HttpError(401, 'Этот passkey не зарегистрирован');
  }
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: takeChallenge('login'),
    expectedOrigin: origins,
    expectedRPID: config.WEBAUTHN_RP_ID,
    requireUserVerification: true,
    credential: { id: row.credential_id, publicKey: new Uint8Array(row.public_key), counter: Number(row.counter), transports: row.transports as never },
  }).catch(() => null);
  if (!verification?.verified) {
    await accountFailure(req, 'login_fail_passkey');
    throw new HttpError(401, 'Face ID не подтверждён');
  }
  await pool.query('UPDATE passkeys SET counter = $2, last_used_at = now() WHERE id = $1', [row.id, verification.authenticationInfo.newCounter]);
  await accountSuccess(req, 'login_ok_passkey');
  issueSession(res, 'passkey');
  res.json({ ok: true });
});
