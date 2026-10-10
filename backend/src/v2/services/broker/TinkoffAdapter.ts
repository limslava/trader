import axios from 'axios';
import https from 'https';
import { BrokerAdapter, BrokerOrderRequest, BrokerOrderResponse } from './BrokerAdapter';
import { TinkoffErrorParser } from './TinkoffErrorParser';

const PROD_BASE = process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/';
const SANDBOX_BASE = process.env.TINKOFF_SANDBOX_API_URL || 'https://sandbox-invest-public-api.tbank.ru/rest/';

const toQuotation = (price: number) => {
  const units = Math.trunc(price);
  const nano = Math.round((price - units) * 1_000_000_000);
  return { units, nano };
};

export class TinkoffAdapter implements BrokerAdapter {
  private errorParser = new TinkoffErrorParser();
  private httpsAgent = process.env.TINKOFF_ALLOW_INSECURE === 'true'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

  async placeOrder(accountId: string, order: BrokerOrderRequest, credential?: string | null): Promise<BrokerOrderResponse> {
    if (!credential) {
      return { brokerOrderId: 'n/a', status: 'rejected', message: 'Missing broker credential' };
    }

    if (order.type === 'stop' || order.type === 'stop_limit') {
      return { brokerOrderId: 'n/a', status: 'rejected', message: 'Stop orders not supported yet' };
    }

    const isSandbox = order.sandbox || process.env.TINKOFF_SANDBOX === 'true';
    const baseUrl = isSandbox ? SANDBOX_BASE : PROD_BASE;
    const url = `${baseUrl}tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder`;

    const direction = order.side === 'buy' ? 'ORDER_DIRECTION_BUY' : 'ORDER_DIRECTION_SELL';
    const orderType = order.type === 'limit' ? 'ORDER_TYPE_LIMIT' : 'ORDER_TYPE_MARKET';

    if (!order.instrumentId) {
      return { brokerOrderId: 'n/a', status: 'rejected', message: 'Missing instrumentId for Tinkoff' };
    }

    const payload: Record<string, any> = {
      quantity: Math.trunc(order.quantity),
      direction,
      accountId,
      orderType,
      orderId: order.clientOrderId || undefined,
      instrumentId: order.instrumentId
    };

    if (order.type === 'limit') {
      if (!order.price) {
        return { brokerOrderId: 'n/a', status: 'rejected', message: 'Limit order requires price' };
      }
      payload.price = toQuotation(order.price);
    } else if (order.price) {
      payload.price = toQuotation(order.price);
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-app-name': process.env.TINKOFF_APP_NAME || 'russian-trader'
        },
        timeout: 8000,
        httpsAgent: this.httpsAgent
      });

      const brokerOrderId = response.data?.orderId || response.data?.order_id || 'tinkoff_order';
      return { brokerOrderId, status: 'accepted' };
    } catch (error: any) {
      const parsed = await this.errorParser.parse(error);
      return { brokerOrderId: 'n/a', status: 'rejected', message: parsed.message, errorCode: parsed.code };
    }
  }
}
