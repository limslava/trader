import { postgresDatabase } from '../../config/postgres';
import { BrokerExecutionService } from './broker/BrokerExecutionService';
import { OrderStateMachine } from './OrderStateMachine';
import { ExecutionRetry } from './ExecutionRetry';
import { TenantPolicyService } from './TenantPolicyService';
import { ExecutionLock } from './ExecutionLock';
import { ExecutionErrorClassifier } from './ExecutionErrorClassifier';

export class ExecutionWorker {
  private brokerExecution = new BrokerExecutionService();
  private sm = new OrderStateMachine();
  private retry = new ExecutionRetry();
  private policyService = new TenantPolicyService();
  private lock = new ExecutionLock();
  private errorClassifier = new ExecutionErrorClassifier();

  async runOnce(): Promise<void> {
    const result = await postgresDatabase.query(
      `SELECT eo.id, eo.tenant_id, eo.broker_account_id, eo.symbol, eo.side, eo.order_type, eo.quantity, eo.price, ba.broker
       FROM execution_orders eo
       JOIN broker_accounts ba ON ba.id = eo.broker_account_id
       WHERE eo.status = 'queued'
         AND (eo.next_retry_at IS NULL OR eo.next_retry_at <= NOW())
       ORDER BY eo.created_at ASC
       LIMIT 10`
    );

    for (const row of result.rows) {
      await this.processRow(row);
    }
  }

  async processOrderId(orderId: string): Promise<void> {
    const result = await postgresDatabase.query(
      `SELECT eo.id, eo.tenant_id, eo.broker_account_id, eo.symbol, eo.side, eo.order_type, eo.quantity, eo.price, ba.broker
       FROM execution_orders eo
       JOIN broker_accounts ba ON ba.id = eo.broker_account_id
       WHERE eo.id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) return;
    await this.processRow(result.rows[0]);
  }

  private async processRow(row: any): Promise<void> {
    const locked = await this.lock.acquire(row.id, 'worker-1', 4000);
    if (!locked) {
      return;
    }
    try {
      const alreadyRouted = await postgresDatabase.query(
        `SELECT id FROM execution_order_events
         WHERE order_id = $1 AND event_type = 'routed'
         LIMIT 1`,
        [row.id]
      );
      if (alreadyRouted.rows.length > 0) {
        return;
      }

      const response = await this.brokerExecution.placeOrder(row.tenant_id, row.broker_account_id, {
        symbol: row.symbol,
        side: row.side,
        type: row.order_type,
        quantity: Number(row.quantity),
        price: row.price,
        clientOrderId: row.id
      });

      const routedMessage = response.status === 'rejected'
        ? (response.message || 'Unknown broker rejection')
        : response.message || null;

      const routedPayload = {
        broker: row.broker,
        brokerOrderId: response.brokerOrderId,
        status: response.status,
        message: routedMessage,
        errorCode: response.errorCode || null
      };

      if (response.status === 'rejected' && this.errorClassifier.isRetryable(response.message)) {
        const attemptRow = await postgresDatabase.query(
          'SELECT attempt_count FROM execution_orders WHERE id = $1',
          [row.id]
        );
        const attempts = attemptRow.rows[0]?.attempt_count ?? 0;
        const policy = await this.policyService.getPolicy(row.tenant_id);
        const shouldRetry = this.retry.shouldRetry(attempts + 1, policy.execution);
        const nextDelay = this.retry.nextDelay(attempts + 1, policy.execution);

        await postgresDatabase.query(
          `UPDATE execution_orders
           SET attempt_count = attempt_count + 1,
               next_retry_at = $1,
               last_error = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [shouldRetry ? new Date(Date.now() + nextDelay) : null, String(routedMessage || 'retryable broker error'), row.id]
        );

        const retryEvent = await postgresDatabase.query(
          `SELECT id FROM execution_order_events
           WHERE order_id = $1 AND event_type = 'retry_scheduled'
           LIMIT 1`,
          [row.id]
        );
        if (retryEvent.rows.length === 0) {
          await postgresDatabase.query(
            `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
             VALUES ($1, 'retry_scheduled', $2, NOW())`,
            [row.id, JSON.stringify({ ...routedPayload, nextRetryAtMs: nextDelay })]
          );
        }

        return;
      }

      await postgresDatabase.query(
        `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
         VALUES ($1, 'routed', $2, NOW())`,
        [row.id, JSON.stringify(routedPayload)]
      );

      const finalStatus = response.status === 'accepted' ? 'accepted' : 'rejected';
      const current = await postgresDatabase.query(
        'SELECT status FROM execution_orders WHERE id = $1',
        [row.id]
      );

      if (current.rows.length > 0) {
        const status = current.rows[0].status as any;
        if (this.sm.canTransition(status, finalStatus as any)) {
          await postgresDatabase.query(
            `UPDATE execution_orders
             SET status = $1,
                 broker_order_id = $2,
                 last_error = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [finalStatus, response.brokerOrderId || null, routedMessage, row.id]
          );
        }
      }
    } catch (error: any) {
      const attemptRow = await postgresDatabase.query(
        'SELECT attempt_count FROM execution_orders WHERE id = $1',
        [row.id]
      );
      const attempts = attemptRow.rows[0]?.attempt_count ?? 0;
      const policy = await this.policyService.getPolicy(row.tenant_id);
      const shouldRetry = this.retry.shouldRetry(attempts + 1, policy.execution);
      const nextDelay = this.retry.nextDelay(attempts + 1, policy.execution);

      await postgresDatabase.query(
        `UPDATE execution_orders
         SET attempt_count = attempt_count + 1,
             next_retry_at = $1,
             last_error = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [shouldRetry ? new Date(Date.now() + nextDelay) : null, String(error?.message || error), row.id]
      );
    }
  }
}
