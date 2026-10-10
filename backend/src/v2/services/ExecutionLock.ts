import { postgresDatabase } from '../../config/postgres';

export class ExecutionLock {
  async acquire(orderId: string, workerId: string, ttlMs = 5000): Promise<boolean> {
    const result = await postgresDatabase.query(
      `UPDATE execution_orders
       SET locked_until = NOW() + ($3 || ' milliseconds')::interval,
           locked_by = $2
       WHERE id = $1 AND (locked_until IS NULL OR locked_until < NOW())
       RETURNING id`,
      [orderId, workerId, ttlMs]
    );

    return result.rows.length > 0;
  }
}
