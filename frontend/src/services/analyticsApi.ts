import api from './api';

export interface AnalyticsReport {
  id: string;
  userId: string;
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PORTFOLIO' | 'MARKET';
  title: string;
  summary: string;
  period: {
    start: string;
    end: string;
  };
  sections: ReportSection[];
  recommendations: ReportRecommendation[];
  riskAssessment: RiskAssessment;
  performanceMetrics: PerformanceMetrics;
  createdAt: string;
  expiresAt?: string;
}

export interface ReportSection {
  title: string;
  type: 'MARKET_OVERVIEW' | 'PORTFOLIO_PERFORMANCE' | 'RISK_ANALYSIS' | 'RECOMMENDATIONS' | 'NEWS_IMPACT';
  content: string;
  data?: any;
  charts?: ChartData[];
  recommendations?: ReportRecommendation[];
  riskAssessment?: RiskAssessment;
  metrics?: PerformanceMetrics;
}

export interface ChartData {
  type: 'LINE' | 'BAR' | 'PIE' | 'GAUGE';
  title: string;
  data: any[];
  options?: any;
}

export interface ReportRecommendation {
  type: 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'DIVERSIFY';
  assetSymbol: string;
  assetName: string;
  confidence: number;
  reason: string;
  action: string;
  timeframe: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

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

export interface PerformanceMetrics {
  portfolioValue: number;
  totalReturn: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  sharpeRatio?: number;
  volatility: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
}

/**
 * API для работы с аналитическими отчетами
 */
export const analyticsApi = {
  /**
   * Получить все отчеты пользователя
   */
  async getReports(): Promise<AnalyticsReport[]> {
    const response = await api.get('/analytics/reports');
    return response.data.data;
  },

  /**
   * Получить отчет по ID
   */
  async getReport(reportId: string): Promise<AnalyticsReport> {
    const response = await api.get(`/analytics/reports/${reportId}`);
    return response.data.data;
  },

  /**
   * Создать ежедневный отчет
   */
  async createDailyReport(): Promise<AnalyticsReport> {
    const response = await api.post('/analytics/reports/daily');
    return response.data.data;
  },

  /**
   * Создать недельный отчет
   */
  async createWeeklyReport(): Promise<AnalyticsReport> {
    const response = await api.post('/analytics/reports/weekly');
    return response.data.data;
  },

  /**
   * Создать отчет по портфелю
   */
  async createPortfolioReport(): Promise<AnalyticsReport> {
    const response = await api.post('/analytics/reports/portfolio');
    return response.data.data;
  },

  /**
   * Удалить отчет
   */
  async deleteReport(reportId: string): Promise<void> {
    await api.delete(`/analytics/reports/${reportId}`);
  },

  /**
   * Получить последний отчет определенного типа
   */
  async getLatestReport(type: string): Promise<AnalyticsReport> {
    const response = await api.get(`/analytics/reports/latest/${type}`);
    return response.data.data;
  }
};