import { postgresDatabase } from '../../../config/postgres';
import { BrokerOrderRequest, BrokerOrderResponse } from './BrokerAdapter';
import { BrokerRouter, BrokerCode } from './BrokerRouter';
import { BrokerCredentialService } from '../secrets/BrokerCredentialService';
import { InstrumentService } from '../InstrumentService';
import { canUseBrokerEnvironment, isBrokerEnvironment, shouldUsePaperExecution } from '../../config/tradingMode';

const supportedBrokers = new Set(['paper', 'tinkoff', 'sber']);

export class BrokerExecutionService {
  private router = new BrokerRouter();
  private credentials = new BrokerCredentialService();
  private instruments = new InstrumentService();

  async placeOrder(tenantId: string, brokerAccountId: string, order: BrokerOrderRequest): Promise<BrokerOrderResponse> {
    const accountResult = await postgresDatabase.query(
      `SELECT id, broker, account_number, environment
       FROM broker_accounts
       WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE`,
      [brokerAccountId, tenantId]
    );

    if (accountResult.rows.length === 0) {
      return { brokerOrderId: 'n/a', status: 'rejected', message: 'Broker account not found' };
    }

    const broker = accountResult.rows[0].broker as string;
    const accountNumber = accountResult.rows[0].account_number as string;
    const environment = accountResult.rows[0].environment as string | null;

    if (!supportedBrokers.has(broker)) {
      return { brokerOrderId: 'n/a', status: 'rejected', message: 'Unsupported broker' };
    }

    if (!isBrokerEnvironment(environment)) {
      return { brokerOrderId: 'n/a', status: 'rejected', message: 'Invalid broker environment' };
    }

    if (!canUseBrokerEnvironment(environment)) {
      return { brokerOrderId: 'n/a', status: 'rejected', message: 'Live broker execution is disabled' };
    }

    if (shouldUsePaperExecution(environment, broker)) {
      const paperAdapter = this.router.getAdapter('paper');
      return paperAdapter.placeOrder(accountNumber || brokerAccountId, { ...order, sandbox: true }, null);
    }

    const adapter = this.router.getAdapter(broker as BrokerCode);
    const credential = await this.credentials.getCredential(tenantId, brokerAccountId);

    let instrumentId = order.instrumentId;
    if (!instrumentId) {
      const exchange = broker === 'tinkoff' || broker === 'sber' ? 'MOEX' : 'CRYPTO';
      instrumentId = await this.instruments.getInstrumentId(exchange, order.symbol);
    }

    const sandbox = environment === 'sandbox' || process.env.TINKOFF_SANDBOX === 'true';
    return adapter.placeOrder(accountNumber || brokerAccountId, { ...order, instrumentId, sandbox }, credential);
  }
}
