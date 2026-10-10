import axios from 'axios';
import crypto from 'crypto';
import { CryptoExchangeAdapter, CryptoOrderRequest, CryptoOrderResponse } from './CryptoExchangeAdapter';
import { CryptoRetry } from './CryptoRetry';
import { exchangeRetryPolicy } from './CryptoRetryPolicy';

const BASE = process.env.BYBIT_API_URL || 'https://api.bybit.com';

export class BybitAdapter implements CryptoExchangeAdapter {
  private retry = new CryptoRetry(exchangeRetryPolicy.bybit);

  async placeOrder(order: CryptoOrderRequest, credential?: string | null): Promise<CryptoOrderResponse> {
    if (!credential) {
      return { exchangeOrderId: 'n/a', status: 'rejected', message: 'Missing credential' };
    }

    // credential format: apiKey:apiSecret
    const [apiKey, apiSecret] = credential.split(':');
    if (!apiKey || !apiSecret) {
      return { exchangeOrderId: 'n/a', status: 'rejected', message: 'Invalid credential format' };
    }

    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const path = '/v5/order/create';

    const body = {
      category: 'spot',
      symbol: order.symbol,
      side: order.side === 'buy' ? 'Buy' : 'Sell',
      orderType: order.type === 'limit' ? 'Limit' : 'Market',
      qty: String(order.quantity),
      price: order.type === 'limit' ? String(order.price ?? '') : undefined,
      timeInForce: order.type === 'limit' ? 'GTC' : undefined
    };

    const payload = JSON.stringify(body);
    const signPayload = timestamp + apiKey + recvWindow + payload;
    const signature = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');

    try {
      const response = await this.retry.withRetry(() => axios.post(`${BASE}${path}`, body, {
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }));

      const orderId = response.data?.result?.orderId || 'bybit_order';
      return { exchangeOrderId: orderId, status: 'accepted' };
    } catch (error: any) {
      return { exchangeOrderId: 'n/a', status: 'rejected', message: error?.message || 'Bybit order failed' };
    }
  }
}
