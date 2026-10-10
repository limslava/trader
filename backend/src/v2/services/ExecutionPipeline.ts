import { postgresDatabase } from '../../config/postgres';
import { OrderStateMachine } from './OrderStateMachine';
import { ExecutionIdempotency } from './ExecutionIdempotency';
import { ExecutionBackpressure } from './ExecutionBackpressure';
import { TenantPolicyService } from './TenantPolicyService';
import { executionQueue } from './queue/QueueRegistry';

export class ExecutionPipeline {
  private sm = new OrderStateMachine();
  private idem = new ExecutionIdempotency();
  private backpressure = new ExecutionBackpressure();
  private policyService = new TenantPolicyService();

  async enqueue(orderId: string): Promise<void> {
    const orderMeta = await postgresDatabase.query(
      'SELECT tenant_id FROM execution_orders WHERE id = $1',
      [orderId]
    );
    const tenantId = orderMeta.rows[0]?.tenant_id;
    if (!tenantId) return;

    const policy = await this.policyService.getPolicy(tenantId);
    const queued = await postgresDatabase.query(
      `SELECT COUNT(*)::int AS count FROM execution_orders WHERE status = 'queued' AND tenant_id = $1`,
      [tenantId]
    );
    if (this.backpressure.shouldThrottle(queued.rows[0]?.count || 0, policy.execution.maxQueued)) {
      return;
    }
    const ok = await this.idem.recordIfNew(orderId, 'queued');
    if (!ok) return;

    if (executionQueue.isReady()) {
      executionQueue.publish(orderId);
    }
    const current = await postgresDatabase.query(
      'SELECT status FROM execution_orders WHERE id = $1',
      [orderId]
    );

    if (current.rows.length === 0) return;
    const status = current.rows[0].status as any;
    if (!this.sm.canTransition(status, 'queued')) return;

    await postgresDatabase.query(
      `UPDATE execution_orders
       SET status = 'queued', updated_at = NOW()
       WHERE id = $1`,
      [orderId]
    );

    await postgresDatabase.query(
      `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
       VALUES ($1, 'queued', $2, NOW())`,
      [orderId, JSON.stringify({ source: 'pipeline' })]
    );
  }
}
