export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'new' | 'accepted' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired';

export interface ExecutionOrder {
  id: string;
  tenantId: string;
  accountId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
