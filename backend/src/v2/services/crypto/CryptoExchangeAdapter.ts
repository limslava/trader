export interface CryptoOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number | null;
}

export interface CryptoOrderResponse {
  exchangeOrderId: string;
  status: 'accepted' | 'rejected';
  message?: string;
}

export interface CryptoExchangeAdapter {
  placeOrder(order: CryptoOrderRequest, credential?: string | null): Promise<CryptoOrderResponse>;
}
