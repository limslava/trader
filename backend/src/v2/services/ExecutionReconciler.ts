import { postgresDatabase } from '../../config/postgres';
import { OrderStateMachine, OrderState } from './OrderStateMachine';

export type FillRecordResult = 'inserted' | 'duplicate' | 'missing';

export class ExecutionReconciler {
  private sm = new OrderStateMachine();

  async recordFill(orderId: string, filledQty: number, price: number, brokerTradeId?: string | null): Promise<FillRecordResult> {
    const orderCheck = await postgresDatabase.query(
      'SELECT id FROM execution_orders WHERE id = $1',
      [orderId]
    );
    if (orderCheck.rows.length === 0) return 'missing';

    const insertResult = await postgresDatabase.query(
      `INSERT INTO execution_fills (order_id, filled_qty, price, broker_trade_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (order_id, broker_trade_id) DO NOTHING
       RETURNING id`,
      [orderId, filledQty, price, brokerTradeId || null]
    );

    return insertResult.rows.length > 0 ? 'inserted' : 'duplicate';
  }

  async updateStatus(orderId: string, nextStatus: OrderState, tenantId?: string): Promise<boolean> {
    const current = await postgresDatabase.query(
      `SELECT status
       FROM execution_orders
       WHERE id = $1${tenantId ? ' AND tenant_id = $2' : ''}`,
      tenantId ? [orderId, tenantId] : [orderId]
    );

    if (current.rows.length === 0) return false;

    const status = current.rows[0].status as OrderState;
    if (!this.sm.canTransition(status, nextStatus)) return false;

    await postgresDatabase.query(
      `UPDATE execution_orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [nextStatus, orderId]
    );

    await postgresDatabase.query(
      `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
       VALUES ($1, 'reconciled', $2, NOW())`,
      [orderId, JSON.stringify({ status: nextStatus })]
    );

    return true;
  }

  async reconcileByFills(orderId: string, tenantId?: string): Promise<OrderState | null> {
    const orderResult = await postgresDatabase.query(
      `SELECT status, quantity FROM execution_orders WHERE id = $1${tenantId ? ' AND tenant_id = $2' : ''}`,
      tenantId ? [orderId, tenantId] : [orderId]
    );

    if (orderResult.rows.length === 0) return null;

    const currentStatus = orderResult.rows[0].status as OrderState;
    const orderQty = Number(orderResult.rows[0].quantity);

    const fillsResult = await postgresDatabase.query(
      'SELECT COALESCE(SUM(filled_qty), 0) AS total_filled FROM execution_fills WHERE order_id = $1',
      [orderId]
    );

    const totalFilled = Number(fillsResult.rows[0]?.total_filled ?? 0);
    let targetStatus: OrderState | null = null;

    if (totalFilled >= orderQty && orderQty > 0) {
      targetStatus = 'filled';
    } else if (totalFilled > 0) {
      targetStatus = 'partially_filled';
    }

    if (!targetStatus) return null;
    if (!this.sm.canTransition(currentStatus, targetStatus)) return null;

    await postgresDatabase.query(
      `UPDATE execution_orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [targetStatus, orderId]
    );

    await postgresDatabase.query(
      `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
       VALUES ($1, 'reconciled', $2, NOW())`,
      [orderId, JSON.stringify({ status: targetStatus, totalFilled })]
    );

    return targetStatus;
  }
}
