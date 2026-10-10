import { postgresDatabase } from '../../config/postgres';

export class ExecutionIdempotency {
  async recordIfNew(orderId: string, eventType: string): Promise<boolean> {
    const existing = await postgresDatabase.query(
      `SELECT id FROM execution_order_events
       WHERE order_id = $1 AND event_type = $2
       LIMIT 1`,
      [orderId, eventType]
    );

    if (existing.rows.length > 0) {
      return false;
    }

    await postgresDatabase.query(
      `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [orderId, eventType, JSON.stringify({ source: 'idempotency' })]
    );

    return true;
  }
}
