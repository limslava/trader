import axios from 'axios';
import crypto from 'crypto';
import { CryptoExchangeAdapter, CryptoOrderRequest, CryptoOrderResponse } from './CryptoExchangeAdapter';
import { CryptoRetry } from './CryptoRetry';
import { exchangeRetryPolicy } from './CryptoRetryPolicy';
import { OkxErrorParser } from './OkxErrorParser';

const BASE = process.env.OKX_API_URL || 'https://www.okx.com';

export class OkxAdapter implements CryptoExchangeAdapter {
  private retry = new CryptoRetry(exchangeRetryPolicy.okx);
  private errorParser = new OkxErrorParser();

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

    const timestamp = new Date().toISOString();
    const path = '/api/v5/trade/order';
    const body = {
      instId: order.symbol,
      tdMode: 'cash',
      side: order.side,
      ordType: order.type === 'limit' ? 'limit' : 'market',
      sz: String(order.quantity),
      px: order.type === 'limit' ? String(order.price ?? '') : undefined
    };

    const payload = JSON.stringify(body);
    const prehash = timestamp + 'POST' + path + payload;
    const sign = crypto.createHmac('sha256', apiSecret).update(prehash).digest('base64');

    try {
      const response = await this.retry.withRetry(() => axios.post(`${BASE}${path}`, body, {
        headers: {
          'OK-ACCESS-KEY': apiKey,
          'OK-ACCESS-SIGN': sign,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': passphrase,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }));

      const orderId = response.data?.data?.[0]?.ordId || 'okx_order';
      return { exchangeOrderId: orderId, status: 'accepted' };
    } catch (error: any) {
      const parsed = await this.errorParser.parse(error);
      return { exchangeOrderId: 'n/a', status: 'rejected', message: parsed.message };
    }
  }
}
