import { CryptoExchangeAdapter, CryptoOrderRequest, CryptoOrderResponse } from './CryptoExchangeAdapter';
import { BybitAdapter } from './BybitAdapter';
import { OkxAdapter } from './OkxAdapter';
import { KucoinAdapter } from './KucoinAdapter';

export class CryptoRouter {
  private adapters: Record<string, CryptoExchangeAdapter> = {
    bybit: new BybitAdapter(),
    okx: new OkxAdapter(),
    kucoin: new KucoinAdapter()
  };

  async placeOrder(exchange: string, order: CryptoOrderRequest, credential?: string | null): Promise<CryptoOrderResponse> {
    const adapter = this.adapters[exchange];
    if (!adapter) {
      return { exchangeOrderId: 'n/a', status: 'rejected', message: 'Unsupported exchange' };
    }
    return adapter.placeOrder(order, credential);
  }
}
