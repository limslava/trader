import { CryptoRouter } from './CryptoRouter';
import { BrokerCredentialService } from '../secrets/BrokerCredentialService';
import { CryptoCredentialValidator } from './CryptoCredentialValidator';

export class CryptoExecutionService {
  private router = new CryptoRouter();
  private credentials = new BrokerCredentialService();
  private validator = new CryptoCredentialValidator();

  async placeOrder(tenantId: string, brokerAccountId: string, exchange: string, order: any) {
    const credential = await this.credentials.getCredential(tenantId, brokerAccountId);
    if (!credential) {
      return { exchangeOrderId: 'n/a', status: 'rejected', message: 'Missing credential' };
    }
    const check = this.validator.validate(exchange, credential);
    if (!check.ok) {
      return { exchangeOrderId: 'n/a', status: 'rejected', message: check.message || 'Invalid credential' };
    }
    return this.router.placeOrder(exchange, order, credential);
  }
}
