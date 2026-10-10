import axios from 'axios';
import { postgresDatabase } from '../../../config/postgres';
import { BrokerCredentialService } from '../secrets/BrokerCredentialService';
import { ExecutionReconciler } from '../ExecutionReconciler';
import { TinkoffStatusMapper } from './TinkoffStatusMapper';

const PROD_BASE = process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/';
const SANDBOX_BASE = process.env.TINKOFF_SANDBOX_API_URL || 'https://sandbox-invest-public-api.tbank.ru/rest/';

export class TinkoffOrderStateService {
  private credentials = new BrokerCredentialService();
  private reconciler = new ExecutionReconciler();
  private statusMapper = new TinkoffStatusMapper();

  async syncOrderState(tenantId: string, brokerAccountId: string, orderId: string): Promise<boolean> {
    const token = await this.credentials.getCredential(tenantId, brokerAccountId);
    if (!token) {
      throw new Error('Missing broker credential');
    }

    const accountResult = await postgresDatabase.query(
      `SELECT account_number, environment
       FROM broker_accounts
       WHERE id = $1 AND tenant_id = $2`,
      [brokerAccountId, tenantId]
    );
    const accountNumber = accountResult.rows[0]?.account_number;
    const environment = accountResult.rows[0]?.environment;
    if (!accountNumber) {
      throw new Error('Missing broker account number');
    }

    const baseUrl = environment === 'sandbox' || process.env.TINKOFF_SANDBOX === 'true' ? SANDBOX_BASE : PROD_BASE;
    const url = `${baseUrl}tinkoff.public.invest.api.contract.v1.OrdersService/GetOrderState`;
    const response = await axios.post(url, { accountId: accountNumber, orderId }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const mapped = this.statusMapper.mapStatus(response.data?.executionReportStatus);
    if (!mapped) return false;

    const applied = await this.reconciler.updateStatus(orderId, mapped as any, tenantId);
    if (applied) {
      await postgresDatabase.query(
        `INSERT INTO execution_order_events (order_id, event_type, payload, created_at)
         VALUES ($1, 'broker_status', $2, NOW())`,
        [orderId, JSON.stringify({ broker: 'tinkoff', status: mapped })]
      );
    }

    return applied;
  }
}
