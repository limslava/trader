import api from './api';

export interface RiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high';
  portfolioRiskScore: number;
  diversificationScore: number;
  concentrationRisk: number;
  volatilityRisk: number;
  recommendations: RiskRecommendation[];
  warnings: RiskWarning[];
}

export interface RiskRecommendation {
  type: 'diversification' | 'stop_loss' | 'position_size' | 'asset_allocation';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  affectedAssets?: string[];
}

export interface RiskWarning {
  type: 'high_volatility' | 'concentration' | 'stop_loss_breach' | 'position_size';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  affectedAsset?: string;
  currentValue?: number;
  threshold?: number;
}

export interface StopLossRecommendation {
  assetSymbol: string;
  currentPrice: number;
  recommendedStopLoss: number;
  stopLossPercentage: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RiskStatistics {
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  diversificationScore: number;
  concentrationRisk: number;
  volatilityRisk: number;
  recommendationsCount: number;
  warningsCount: number;
  criticalWarningsCount: number;
  stopLossCoverage: number;
}

export interface TradeRiskCheck {
  tradeValue: number;
  maxPositionSize: number;
  isWithinLimits: boolean;
  portfolioPercentage: number;
  recommendation: string;
}

export interface MaxPositionSize {
  maxPositionSize: number;
  totalPortfolioValue: number;
  riskTolerance: 'low' | 'medium' | 'high';
  recommendation: string;
}

class RiskApi {
  /**
   * Получение полной оценки рисков портфеля
   */
  async getRiskAssessment(): Promise<RiskAssessment> {
    const response = await api.get('/risk/assessment');
    return response.data.data;
  }

  /**
   * Получение рекомендаций по стоп-лоссам
   */
  async getStopLossRecommendations(): Promise<StopLossRecommendation[]> {
    const response = await api.get('/risk/stop-loss-recommendations');
    return response.data.data;
  }

  /**
   * Расчет максимального размера позиции
   */
  async getMaxPositionSize(riskTolerance?: 'low' | 'medium' | 'high'): Promise<MaxPositionSize> {
    const params = riskTolerance ? { riskTolerance } : {};
    const response = await api.get('/risk/max-position-size', { params });
    return response.data.data;
  }

  /**
   * Проверка риска для конкретной сделки
   */
  async checkTradeRisk(data: {
    assetSymbol: string;
    assetType: 'stock' | 'crypto' | 'currency';
    quantity: number;
    price: number;
    transactionType: 'buy' | 'sell';
  }): Promise<TradeRiskCheck> {
    const response = await api.post('/risk/trade-risk-check', data);
    return response.data.data;
  }

  /**
   * Получение статистики рисков
   */
  async getRiskStatistics(): Promise<RiskStatistics> {
    const response = await api.get('/risk/statistics');
    return response.data.data;
  }
}

export const riskApi = new RiskApi();