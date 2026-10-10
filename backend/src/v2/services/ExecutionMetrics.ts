import { postgresDatabase } from '../../config/postgres';

export class ExecutionMetrics {
  async snapshot(): Promise<{ queued: number; accepted: number; rejected: number }> {
    const result = await postgresDatabase.query(
      `SELECT status, COUNT(*)::int AS count
       FROM execution_orders
       GROUP BY status`
    );

    const map: Record<string, number> = {};
    for (const row of result.rows) {
      map[row.status] = row.count;
    }

    return {
      queued: map['queued'] || 0,
      accepted: map['accepted'] || 0,
      rejected: map['rejected'] || 0
    };
  }

  async latencyBuckets(): Promise<{
    queued: Record<string, number>;
    executed: Record<string, number>;
  }> {
    const queued = await postgresDatabase.query(
      `SELECT
        SUM(CASE WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) <= 1 THEN 1 ELSE 0 END)::int AS le_1s,
        SUM(CASE WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) <= 5 THEN 1 ELSE 0 END)::int AS le_5s,
        SUM(CASE WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) <= 30 THEN 1 ELSE 0 END)::int AS le_30s,
        SUM(CASE WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) <= 60 THEN 1 ELSE 0 END)::int AS le_60s,
        SUM(CASE WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) > 60 THEN 1 ELSE 0 END)::int AS gt_60s
       FROM execution_orders
       WHERE status = 'queued'`
    );

    const executed = await postgresDatabase.query(
      `SELECT
        SUM(CASE WHEN EXTRACT(EPOCH FROM (updated_at - created_at)) <= 1 THEN 1 ELSE 0 END)::int AS le_1s,
        SUM(CASE WHEN EXTRACT(EPOCH FROM (updated_at - created_at)) <= 5 THEN 1 ELSE 0 END)::int AS le_5s,
        SUM(CASE WHEN EXTRACT(EPOCH FROM (updated_at - created_at)) <= 30 THEN 1 ELSE 0 END)::int AS le_30s,
        SUM(CASE WHEN EXTRACT(EPOCH FROM (updated_at - created_at)) <= 60 THEN 1 ELSE 0 END)::int AS le_60s,
        SUM(CASE WHEN EXTRACT(EPOCH FROM (updated_at - created_at)) > 60 THEN 1 ELSE 0 END)::int AS gt_60s
       FROM execution_orders
       WHERE status IN ('accepted', 'filled', 'rejected', 'cancelled')`
    );

    return {
      queued: queued.rows[0] || {},
      executed: executed.rows[0] || {}
    };
  }

  async latencyPercentiles(windowMinutes = 60, tenantId?: string): Promise<{ p50: number; p95: number; p99: number }> {
    const tenantFilter = tenantId ? 'AND tenant_id = $2' : '';
    const params = tenantId ? [windowMinutes, tenantId] : [windowMinutes];
    const result = await postgresDatabase.query(
      `WITH durations AS (
        SELECT EXTRACT(EPOCH FROM (updated_at - created_at)) AS dur
        FROM execution_orders
        WHERE status IN ('accepted', 'filled', 'rejected', 'cancelled')
          AND created_at >= NOW() - ($1 || ' minutes')::interval
          ${tenantFilter}
      )
      SELECT
        COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY dur), 0) AS p50,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY dur), 0) AS p95,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY dur), 0) AS p99
      FROM durations`,
      params
    );

    return {
      p50: Number(result.rows[0]?.p50 || 0),
      p95: Number(result.rows[0]?.p95 || 0),
      p99: Number(result.rows[0]?.p99 || 0)
    };
  }
}
