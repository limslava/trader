import { postgresDatabase } from '../../config/postgres';

export class AnalyticsService {
  async buildSnapshot(tenantId: string, windowMinutes: number): Promise<any> {
    const safeWindow = Number.isFinite(windowMinutes) && windowMinutes > 0 ? Math.trunc(windowMinutes) : 60;

    const orders = await postgresDatabase.query(
      `SELECT status, COUNT(*)::int AS count
       FROM execution_orders
       WHERE tenant_id = $1
         AND created_at >= NOW() - ($2 || ' minutes')::interval
       GROUP BY status`,
      [tenantId, safeWindow]
    );

    const fills = await postgresDatabase.query(
      `SELECT COALESCE(SUM(filled_qty), 0) AS total_qty,
              COALESCE(SUM(filled_qty * ef.price), 0) AS total_notional,
              COALESCE(AVG(ef.price), 0) AS avg_price
       FROM execution_fills ef
       JOIN execution_orders eo ON eo.id = ef.order_id
       WHERE eo.tenant_id = $1
         AND ef.created_at >= NOW() - ($2 || ' minutes')::interval`,
      [tenantId, safeWindow]
    );

    const avgOrderPrice = await postgresDatabase.query(
      `SELECT COALESCE(AVG(price), 0) AS avg_price
       FROM execution_orders
       WHERE tenant_id = $1
         AND price IS NOT NULL
         AND created_at >= NOW() - ($2 || ' minutes')::interval`,
      [tenantId, safeWindow]
    );

    const rejections = await postgresDatabase.query(
      `SELECT COALESCE(payload->>'message', 'unknown') AS message,
              COUNT(*)::int AS count
       FROM execution_order_events eoe
       JOIN execution_orders eo ON eo.id = eoe.order_id
       WHERE eo.tenant_id = $1
         AND eoe.event_type = 'routed'
         AND COALESCE(payload->>'status', '') = 'rejected'
         AND eoe.created_at >= NOW() - ($2 || ' minutes')::interval
       GROUP BY COALESCE(payload->>'message', 'unknown')
       ORDER BY count DESC
       LIMIT 10`,
      [tenantId, safeWindow]
    );

    return {
      windowMinutes: safeWindow,
      orders: orders.rows,
      fills: {
        totalQty: Number(fills.rows[0]?.total_qty ?? 0),
        totalNotional: Number(fills.rows[0]?.total_notional ?? 0),
        avgPrice: Number(fills.rows[0]?.avg_price ?? 0)
      },
      avgOrderPrice: Number(avgOrderPrice.rows[0]?.avg_price ?? 0),
      rejections: rejections.rows
    };
  }

  async storeSnapshot(tenantId: string, windowMinutes: number, payload: any): Promise<string> {
    const result = await postgresDatabase.query(
      `INSERT INTO analytics_snapshots (tenant_id, window_minutes, payload, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [tenantId, windowMinutes, JSON.stringify(payload)]
    );
    return result.rows[0]?.id;
  }

  async listSnapshots(tenantId: string, limit = 20): Promise<any[]> {
    const result = await postgresDatabase.query(
      `SELECT id, window_minutes, payload, created_at
       FROM analytics_snapshots
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  }
}
