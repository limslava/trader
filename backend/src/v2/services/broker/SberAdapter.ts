import { BrokerAdapter, BrokerOrderRequest, BrokerOrderResponse } from './BrokerAdapter';

export class SberAdapter implements BrokerAdapter {
  async placeOrder(_accountId: string, _order: BrokerOrderRequest, credential?: string | null): Promise<BrokerOrderResponse> {
    // TODO: Реальная интеграция Sber брокера
    return {
      brokerOrderId: 'n/a',
      status: 'rejected',
      message: credential ? 'Sber adapter not implemented yet' : 'Missing broker credential'
    };
  }
}
