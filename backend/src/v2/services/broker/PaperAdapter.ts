import { BrokerAdapter, BrokerOrderRequest, BrokerOrderResponse } from './BrokerAdapter';

export class PaperAdapter implements BrokerAdapter {
  async placeOrder(_accountId: string, order: BrokerOrderRequest): Promise<BrokerOrderResponse> {
    const orderId = order.clientOrderId || `${Date.now()}`;
    return {
      brokerOrderId: `paper_${orderId}`,
      status: 'accepted',
      message: 'Paper order accepted without external broker execution'
    };
  }
}
