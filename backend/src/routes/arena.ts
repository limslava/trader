import { Router } from 'express';
import { z } from 'zod';
import {
  agentDetail,
  agentRunning,
  availableModels,
  setAgentModel,
  leaderboard,
  GROUPS,
  PERSONAS,
  RISK,
  RUN_HOUR_MSK,
  roundRunning,
  runAgent,
  runAll,
  setAgentStatus,
  setPaused,
  setupGroup,
  teardownGroup,
} from '../arena.js';
import { HttpError } from '../http.js';
import { tinkoffConfigured } from '../tinkoff.js';

export const arenaRouter = Router();

const idParam = (v: unknown) => z.coerce.number().int().positive().parse(v);

arenaRouter.get('/', async (_req, res) => {
  const models = await availableModels();
  res.json({
    configured: tinkoffConfigured() && models.length > 0,
    models,
    personas: Object.entries(PERSONAS).map(([key, p]) => ({ key, name: p.name, tagline: p.tagline })),
    risk: RISK,
    runHourMsk: RUN_HOUR_MSK,
    ...(await leaderboard()),
  });
});

arenaRouter.put('/agents/:id/model', async (req, res) => {
  const { model } = z.object({ model: z.string().min(1).max(100).nullable() }).parse(req.body);
  await setAgentModel(idParam(req.params.id), model);
  res.json({ ok: true });
});

const groupSchema = z.enum(Object.keys(GROUPS) as [keyof typeof GROUPS, ...(keyof typeof GROUPS)[]]);

arenaRouter.post('/groups/:group', async (req, res) => {
  const { capital } = z.object({ capital: z.coerce.number().min(10_000).max(30_000_000).default(100_000) }).parse(req.body ?? {});
  res.json(await setupGroup(groupSchema.parse(req.params.group), capital));
});

arenaRouter.delete('/groups/:group', async (req, res) => {
  await teardownGroup(groupSchema.parse(req.params.group));
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
  if (roundRunning()) throw new HttpError(409, 'Раунд уже идёт');
  runAll().catch((err) => console.error('Arena round:', err instanceof Error ? err.message : err));
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
