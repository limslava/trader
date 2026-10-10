import { postgresDatabase } from '../../../config/postgres';

export class SecretAuditLog {
  async record(tenantId: string, userId: string, action: string, ref: string): Promise<void> {
    await postgresDatabase.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, payload, created_at)
       VALUES ($1, $2, $3, 'secret', $4, $5, NOW())`,
      [tenantId, userId, action, ref, JSON.stringify({ ref })]
    );
  }
}
