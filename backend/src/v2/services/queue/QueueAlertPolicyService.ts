import { postgresDatabase } from '../../../config/postgres';

export class QueueAlertPolicyService {
  async getLagThreshold(tenantId: string): Promise<number> {
    const result = await postgresDatabase.query(
      'SELECT policy FROM tenant_policies WHERE tenant_id = $1',
      [tenantId]
    );
    if (result.rows.length === 0) return 1000;
    const policy = result.rows[0].policy || {};
    const value = policy?.queue?.lagThreshold;
    if (typeof value !== 'number' || value < 0) return 1000;
    return value;
  }

  async getCriticalLagThreshold(tenantId: string): Promise<number> {
    const result = await postgresDatabase.query(
      'SELECT policy FROM tenant_policies WHERE tenant_id = $1',
      [tenantId]
    );
    const policy = result.rows[0]?.policy || {};
    const value = policy?.queue?.lagCriticalThreshold;
    if (typeof value === 'number' && value >= 0) return value;

    const envValue = Number(process.env.QUEUE_LAG_CRITICAL || process.env.JS_LAG_CRITICAL || '');
    if (Number.isFinite(envValue) && envValue >= 0) return envValue;

    const base = await this.getLagThreshold(tenantId);
    return Math.max(5000, base * 5);
  }
}
