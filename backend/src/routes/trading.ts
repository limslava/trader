import { Router } from 'express';
import { z } from 'zod';
import { isSandbox, tinkoffConfigured } from '../tinkoff.js';
import {
  activeOrders,
  assertSandbox,
  cancelOrder,
  closeAccount,
  openAccount,
  operations,
  payIn,
  placeOrder,
  portfolio,
  requireAccount,
  tradingStatus,
} from '../trading.js';
import { secidSchema } from './market.js';

export const tradingRouter = Router();

tradingRouter.get('/status', (_req, res) => {
  res.json({ configured: tinkoffConfigured(), sandbox: isSandbox });
});

// Everything below talks to the broker and is sandbox-only.
tradingRouter.use((_req, _res, next) => {
  assertSandbox();
  next();
});

const amountSchema = z.object({ amount: z.coerce.number().positive().max(30_000_000) });

tradingRouter.post('/account', async (req, res) => {
  const { amount } = amountSchema.parse(req.body);
  res.json({ accountId: await openAccount(amount) });
});

tradingRouter.post('/account/payin', async (req, res) => {
  const { amount } = amountSchema.parse(req.body);
  await payIn((await requireAccount()).id, amount);
  res.json({ ok: true });
});

tradingRouter.delete('/account', async (_req, res) => {
  await closeAccount();
  res.json({ ok: true });
});

tradingRouter.get('/portfolio', async (_req, res) => {
  res.json(await portfolio());
});

tradingRouter.get('/instrument/:secid', async (req, res) => {
  res.json(await tradingStatus(secidSchema.parse(req.params.secid)));
});

tradingRouter.get('/orders', async (_req, res) => {
  res.json(await activeOrders());
});

tradingRouter.post('/orders', async (req, res) => {
  const input = z
    .object({
      secid: secidSchema,
      direction: z.enum(['buy', 'sell']),
      lots: z.coerce.number().int().min(1).max(100_000),
      type: z.enum(['market', 'limit']),
      price: z.coerce.number().positive().optional(),
    })
    .parse(req.body);
  res.json(await placeOrder(input));
});

tradingRouter.delete('/orders/:orderId', async (req, res) => {
  await cancelOrder(z.string().min(1).max(100).parse(req.params.orderId));
  res.json({ ok: true });
});

tradingRouter.get('/operations', async (_req, res) => {
  res.json(await operations());
});
