export interface BrokerOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number | null;
  clientOrderId?: string;
  instrumentId?: string | null;
  sandbox?: boolean;
}

export interface BrokerOrderResponse {
  brokerOrderId: string;
  status: 'accepted' | 'rejected';
  message?: string;
  errorCode?: string;
}

export interface BrokerAdapter {
  placeOrder(accountId: string, order: BrokerOrderRequest, credential?: string | null): Promise<BrokerOrderResponse>;
}
