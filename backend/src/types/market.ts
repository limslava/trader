export interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  timestamp: Date;
}

export interface TechnicalIndicators {
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  movingAverages?: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  support?: number;
  resistance?: number;
  trend?: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  exchange: 'MOEX' | 'BINANCE' | 'SPB';
  type: AssetType;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  marketCap?: number;
  technicalIndicators?: TechnicalIndicators;
  lastUpdated: Date;
}

export type AssetType = 'STOCK' | 'CRYPTO' | 'ETF' | 'BOND' | 'FUTURES';

export interface MarketData {
  assets: Asset[];
  timestamp: Date;
}

export interface AnalysisResult {
  symbol: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  technicalScore: number;
  fundamentalScore?: number;
  sentimentScore?: number;
  priceTarget?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: Date;
}