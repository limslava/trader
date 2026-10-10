import axios from 'axios';
import crypto from 'crypto';
import { CryptoExchangeAdapter, CryptoOrderRequest, CryptoOrderResponse } from './CryptoExchangeAdapter';
import { CryptoRetry } from './CryptoRetry';
import { exchangeRetryPolicy } from './CryptoRetryPolicy';
import { KucoinErrorParser } from './KucoinErrorParser';

const BASE = process.env.KUCOIN_API_URL || 'https://api.kucoin.com';

export class KucoinAdapter implements CryptoExchangeAdapter {
  private retry = new CryptoRetry(exchangeRetryPolicy.kucoin);
  private errorParser = new KucoinErrorParser();

  async placeOrder(order: CryptoOrderRequest, credential?: string | null): Promise<CryptoOrderResponse> {
    if (!credential) {
      return { exchangeOrderId: 'n/a', status: 'rejected', message: 'Missing credential' };
    }

    // credential format: apiKey:apiSecret:passphrase
    const parts = credential.split(':');
    const [apiKey, apiSecret, passphrase] = parts;
    if (!apiKey || !apiSecret || !passphrase) {
      return { exchangeOrderId: 'n/a', status: 'rejected', message: 'Invalid credential format' };
    }

    const timestamp = Date.now().toString();
    const path = '/api/v1/orders';
    const body = {
      symbol: order.symbol,
      side: order.side,
      type: order.type === 'limit' ? 'limit' : 'market',
      size: String(order.quantity),
      price: order.type === 'limit' ? String(order.price ?? '') : undefined
    };

    const payload = JSON.stringify(body);
    const prehash = timestamp + 'POST' + path + payload;
    const sign = crypto.createHmac('sha256', apiSecret).update(prehash).digest('base64');

    try {
      const response = await this.retry.withRetry(() => axios.post(`${BASE}${path}`, body, {
        headers: {
          'KC-API-KEY': apiKey,
          'KC-API-SIGN': sign,
          'KC-API-TIMESTAMP': timestamp,
          'KC-API-PASSPHRASE': passphrase,
          'KC-API-KEY-VERSION': '2',
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }));

      const orderId = response.data?.data?.orderId || 'kucoin_order';
      return { exchangeOrderId: orderId, status: 'accepted' };
    } catch (error: any) {
      const parsed = await this.errorParser.parse(error);
      return { exchangeOrderId: 'n/a', status: 'rejected', message: parsed.message };
    }
  }
}
