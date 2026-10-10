export type MarketSource = 'moex' | 'crypto';

export interface MarketTick {
  symbol: string;
  price: number;
  ts: number;
  source: MarketSource;
}

export interface NormalizedTick {
  symbol: string;
  price: number;
  ts: number;
  source: MarketSource;
  normalizedSymbol: string;
  exchange: string;
}
