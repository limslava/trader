import { Router } from 'express';
import { postgresDatabase } from '../../config/postgres';
import { ExecutionMetrics } from '../services/ExecutionMetrics';
import { QueueMetrics } from '../services/queue/QueueMetrics';
import { JetStreamLagMetrics } from '../services/queue/JetStreamLagMetrics';
import { QueueAlerts } from '../services/queue/QueueAlerts';
import { authenticateV2, AuthedRequest, requireRole } from '../middleware/auth';

const router = Router();
const execMetrics = new ExecutionMetrics();
const queueMetrics = new QueueMetrics();
const lagMetrics = new JetStreamLagMetrics();
const queueAlerts = new QueueAlerts();

router.get('/public', async (_req, res) => {
  try {
    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        console.warn('Public metrics partial error:', error);
        return fallback;
      }
    };

    const execution = await safe(() => execMetrics.snapshot(), { queued: 0, accepted: 0, rejected: 0 });
    const latency = await safe(() => execMetrics.latencyBuckets(), { queued: {}, executed: {} });
    const percentiles = await safe(() => execMetrics.latencyPercentiles(60), { p50: 0, p95: 0, p99: 0 });
    const queue = await safe(() => queueMetrics.streamInfo(), null);
    const consumer = await safe(() => queueMetrics.consumerInfo(), null);
    const lag = await safe(() => lagMetrics.getLag(), null);
    const lagTrend = await safe(() => lagMetrics.getLagTrend(), null);

    const lastTicks = await safe(
      () =>
        postgresDatabase.query(
          `SELECT exchange, symbol, MAX(ts) AS last_ts
           FROM market_ticks
           GROUP BY exchange, symbol
           ORDER BY last_ts DESC
           LIMIT 20`
        ),
      { rows: [] as Array<{ exchange: string; symbol: string; last_ts: string }> }
    );

    return res.status(200).json({
      execution,
      latency,
      percentiles: { ...percentiles, windowMinutes: 60 },
      queue,
      consumer,
      lag,
      lagTrend,
      recentTicks: lastTicks.rows
    });
  } catch (error) {
    console.error('V2 metrics public error:', error);
    return res.status(500).json({ error: 'Internal Error', message: 'Metrics failed' });
  }
});

router.get('/', authenticateV2, requireRole(['owner', 'admin']), async (req: AuthedRequest, res) => {
  const tenantId = req.auth!.tenantId;

  const orders = await postgresDatabase.query(
    `SELECT status, COUNT(*)::int AS count
     FROM execution_orders
     WHERE tenant_id = $1
     GROUP BY status`,
    [tenantId]
  );

  const execution = await execMetrics.snapshot();
  const latency = await execMetrics.latencyBuckets();
  const windowMinutes = Number(req.query.windowMinutes || 60);
  const percentiles = await execMetrics.latencyPercentiles(Number.isFinite(windowMinutes) ? windowMinutes : 60, tenantId);
  const queue = await queueMetrics.streamInfo();
  const consumer = await queueMetrics.consumerInfo();
  const lag = await lagMetrics.getLag();
  const lagTrend = await lagMetrics.getLagTrend();
  const alert = await queueAlerts.shouldAlert(tenantId);

  const lastTicks = await postgresDatabase.query(
    `SELECT exchange, symbol, MAX(ts) AS last_ts
     FROM market_ticks
     GROUP BY exchange, symbol
     ORDER BY last_ts DESC
     LIMIT 20`
  );

  const errorBreakdown = await postgresDatabase.query(
    `SELECT COALESCE(m.message, payload->>'message', 'unknown') AS message,
            COUNT(*)::int AS count
     FROM execution_order_events eoe
     JOIN execution_orders eo ON eo.id = eoe.order_id
     LEFT JOIN tinkoff_error_map m ON m.code = eoe.payload->>'errorCode'
     WHERE eo.tenant_id = $1
       AND eoe.event_type = 'routed'
       AND COALESCE(payload->>'status', '') = 'rejected'
     GROUP BY COALESCE(m.message, payload->>'message', 'unknown')
     ORDER BY count DESC
     LIMIT 20`,
    [tenantId]
  );

  const lastErrors = await postgresDatabase.query(
    `SELECT last_error, COUNT(*)::int AS count
     FROM execution_orders
     WHERE tenant_id = $1
       AND last_error IS NOT NULL
       AND last_error <> ''
     GROUP BY last_error
     ORDER BY count DESC
     LIMIT 20`,
    [tenantId]
  );

  return res.status(200).json({
    orders: orders.rows,
    execution,
    latency,
    percentiles,
    queue,
    consumer,
    lag,
    lagTrend,
    alert,
    recentTicks: lastTicks.rows,
    errors: {
      routedRejections: errorBreakdown.rows,
      lastErrors: lastErrors.rows
    }
  });
});

export default router;
