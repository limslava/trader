import { Router } from 'express';
import { z } from 'zod';
import {
  agentDetail,
  agentRunning,
  leaderboard,
  PERSONAS,
  RISK,
  RUN_HOUR_MSK,
  runAgent,
  runAll,
  setAgentStatus,
  setPaused,
  setupArena,
  teardownArena,
} from '../arena.js';
import { aiConfigured } from '../ai.js';
import { HttpError } from '../http.js';
import { isSandbox, tinkoffConfigured } from '../tinkoff.js';
import { assertSandbox } from '../trading.js';

export const arenaRouter = Router();

const idParam = (v: unknown) => z.coerce.number().int().positive().parse(v);

arenaRouter.get('/', async (_req, res) => {
  res.json({
    configured: tinkoffConfigured() && isSandbox && aiConfigured(),
    personas: Object.entries(PERSONAS).map(([key, p]) => ({ key, name: p.name, tagline: p.tagline })),
    risk: RISK,
    runHourMsk: RUN_HOUR_MSK,
    ...(await leaderboard()),
  });
});

arenaRouter.use((_req, _res, next) => {
  assertSandbox();
  if (!aiConfigured()) throw new HttpError(503, 'AI не настроен: задайте AI_API_KEY в .env');
  next();
});

arenaRouter.post('/setup', async (req, res) => {
  const { capital } = z.object({ capital: z.coerce.number().min(10_000).max(30_000_000).default(100_000) }).parse(req.body ?? {});
  res.json(await setupArena(capital));
});

arenaRouter.delete('/', async (_req, res) => {
  await teardownArena();
  res.json({ ok: true });
});

arenaRouter.post('/pause', async (_req, res) => {
  await setPaused(true);
  res.json({ ok: true });
});

arenaRouter.post('/resume', async (_req, res) => {
  await setPaused(false);
  res.json({ ok: true });
});

/** Fire-and-forget: agents run one after another, the page polls the leaderboard. */
arenaRouter.post('/run', (_req, res) => {
  void runAll();
  res.status(202).json({ ok: true });
});

arenaRouter.get('/agents/:id', async (req, res) => {
  res.json(await agentDetail(idParam(req.params.id)));
});

arenaRouter.post('/agents/:id/run', (req, res) => {
  const id = idParam(req.params.id);
  if (agentRunning(id)) throw new HttpError(409, 'Агент уже принимает решение');
  runAgent(id).catch((err) => console.error(`Arena: agent ${id} failed:`, err instanceof Error ? err.message : err));
  res.status(202).json({ ok: true });
});

arenaRouter.post('/agents/:id/stop', async (req, res) => {
  await setAgentStatus(idParam(req.params.id), 'stopped', 'Остановлен вручную');
  res.json({ ok: true });
});

arenaRouter.post('/agents/:id/resume', async (req, res) => {
  await setAgentStatus(idParam(req.params.id), 'active');
  res.json({ ok: true });
});
