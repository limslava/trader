import { postgresDatabase } from '../../../config/postgres';

export class SecretRegistry {
  async register(tenantId: string, brokerAccountId: string, ref: string): Promise<void> {
    const accountCheck = await postgresDatabase.query(
      `SELECT id FROM broker_accounts WHERE id = $1 AND tenant_id = $2`,
      [brokerAccountId, tenantId]
    );
    if (accountCheck.rows.length === 0) {
      throw new Error('Broker account not found for tenant');
    }

    await postgresDatabase.query(
      `UPDATE broker_credentials bc
       SET is_active = FALSE, revoked_at = NOW()
       FROM broker_accounts ba
       WHERE bc.broker_account_id = ba.id
         AND bc.broker_account_id = $1
         AND ba.tenant_id = $2
         AND bc.is_active = TRUE`,
      [brokerAccountId, tenantId]
    );

    await postgresDatabase.query(
      `INSERT INTO broker_credentials (broker_account_id, secret_ref, is_active, created_at)
       VALUES ($1, $2, TRUE, NOW())`,
      [brokerAccountId, ref]
    );
  }

  async getRef(tenantId: string, brokerAccountId: string): Promise<string | null> {
    const result = await postgresDatabase.query(
      `SELECT bc.secret_ref
       FROM broker_credentials bc
       JOIN broker_accounts ba ON ba.id = bc.broker_account_id
       WHERE bc.broker_account_id = $1 AND ba.tenant_id = $2 AND bc.is_active = TRUE
       ORDER BY bc.created_at DESC
       LIMIT 1`,
      [brokerAccountId, tenantId]
    );

    return result.rows[0]?.secret_ref || null;
  }

  async revoke(tenantId: string, brokerAccountId: string): Promise<void> {
    await postgresDatabase.query(
      `UPDATE broker_credentials bc
       SET is_active = FALSE, revoked_at = NOW()
       FROM broker_accounts ba
       WHERE bc.broker_account_id = ba.id
         AND bc.broker_account_id = $1
         AND ba.tenant_id = $2
         AND bc.is_active = TRUE`,
      [brokerAccountId, tenantId]
    );
  }
}
