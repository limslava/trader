// Локальные типы для совместимости
interface RiskAssessment {
  overallRiskLevel: string;
  portfolioRiskScore: number;
  diversificationScore: number;
  concentrationRisk: number;
  volatilityRisk: number;
  recommendations: any[];
  warnings: any[];
}

interface RiskRecommendation {
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
}

interface RiskWarning {
  type: string;
  severity: string;
  title: string;
  description: string;
  affectedAsset?: string;
}

export interface PortfolioPosition {
  assetSymbol: string;
  assetType: 'stock' | 'crypto' | 'currency';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number;
}

export interface AnalyticsReport {
  id: string;
  userId: string;
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PORTFOLIO' | 'MARKET';
  title: string;
  summary: string;
  period: {
    start: Date;
    end: Date;
  };
  sections: ReportSection[];
  recommendations: ReportRecommendation[];
  riskAssessment: RiskAssessment;
  performanceMetrics: PerformanceMetrics;
  createdAt: Date;
  expiresAt?: Date;
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

export class AnalyticsReportService {
  private reports: Map<string, AnalyticsReport> = new Map();

  /**
   * Генерация ежедневного отчета
   */
  async generateDailyReport(userId: string, portfolioPositions: PortfolioPosition[]): Promise<AnalyticsReport> {
    const reportId = `daily_${userId}_${Date.now()}`;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const marketOverview = await this.generateMarketOverview();
    const portfolioPerformance = await this.generatePortfolioPerformance(portfolioPositions);
    const riskAnalysis = await this.generateRiskAnalysis(portfolioPositions);
    const recommendations = await this.generateRecommendations(portfolioPositions);

    const report: AnalyticsReport = {
      id: reportId,
      userId,
      type: 'DAILY',
      title: `Ежедневный отчет трейдера - ${now.toLocaleDateString('ru-RU')}`,
      summary: this.generateSummary(marketOverview, portfolioPerformance, riskAnalysis),
      period: {
        start: startOfDay,
        end: now
      },
      sections: [
        marketOverview,
        portfolioPerformance,
        riskAnalysis,
        recommendations
      ],
      recommendations: recommendations.recommendations || [],
      riskAssessment: riskAnalysis.riskAssessment!,
      performanceMetrics: portfolioPerformance.metrics!,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 часа
    };

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * Генерация недельного отчета
   */
  async generateWeeklyReport(userId: string, portfolioPositions: PortfolioPosition[]): Promise<AnalyticsReport> {
    const reportId = `weekly_${userId}_${Date.now()}`;
    const now = new Date();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const report: AnalyticsReport = {
      id: reportId,
      userId,
      type: 'WEEKLY',
      title: `Недельный отчет трейдера - ${now.toLocaleDateString('ru-RU')}`,
      summary: 'Анализ эффективности портфеля за прошедшую неделю',
      period: {
        start: startOfWeek,
        end: now
      },
      sections: await this.generateWeeklySections(portfolioPositions),
      recommendations: await this.generateWeeklyRecommendations(portfolioPositions),
      riskAssessment: await this.generateWeeklyRiskAssessment(portfolioPositions),
      performanceMetrics: await this.calculateWeeklyMetrics(portfolioPositions),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 дней
    };

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * Генерация отчета по портфелю
   */
  async generatePortfolioReport(userId: string, portfolioPositions: PortfolioPosition[]): Promise<AnalyticsReport> {
    const reportId = `portfolio_${userId}_${Date.now()}`;
    const now = new Date();
    
    const report: AnalyticsReport = {
      id: reportId,
      userId,
      type: 'PORTFOLIO',
      title: 'Полный анализ портфеля',
      summary: 'Детальный анализ текущего состояния портфеля и рекомендации по оптимизации',
      period: {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 дней назад
        end: now
      },
      sections: await this.generatePortfolioSections(portfolioPositions),
      recommendations: await this.generatePortfolioRecommendations(portfolioPositions),
      riskAssessment: await this.generatePortfolioRiskAssessment(portfolioPositions),
      performanceMetrics: await this.calculatePortfolioMetrics(portfolioPositions),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 дней
    };

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * Получить отчет по ID
   */
  async getReport(reportId: string): Promise<AnalyticsReport | null> {
    return this.reports.get(reportId) || null;
  }

  /**
   * Получить все отчеты пользователя
   */
  async getUserReports(userId: string): Promise<AnalyticsReport[]> {
    return Array.from(this.reports.values())
      .filter(report => report.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Удалить устаревшие отчеты
   */
  async cleanupExpiredReports(): Promise<void> {
    const now = new Date();
    for (const [reportId, report] of this.reports.entries()) {
      if (report.expiresAt && report.expiresAt < now) {
        this.reports.delete(reportId);
      }
    }
  }

  // Вспомогательные методы

  private async generateMarketOverview(): Promise<ReportSection> {
    return {
      title: 'Обзор рынка',
      type: 'MARKET_OVERVIEW',
      content: 'Анализ текущей рыночной ситуации и ключевых трендов',
      data: {
        marketSentiment: 'NEUTRAL',
        volatility: 'MEDIUM',
        keyEvents: [
          'Рост российских акций на фоне укрепления рубля',
          'Коррекция криптовалютного рынка',
          'Стабильность на рынке облигаций'
        ]
      },
      charts: [
        {
          type: 'LINE',
          title: 'Динамика индекса Мосбиржи',
          data: this.generateMockChartData()
        }
      ]
    };
  }

  private async generatePortfolioPerformance(positions: PortfolioPosition[]): Promise<ReportSection> {
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
    const totalProfit = totalValue - totalCost;
    const profitPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return {
      title: 'Эффективность портфеля',
      type: 'PORTFOLIO_PERFORMANCE',
      content: `Общая стоимость портфеля: ${totalValue.toLocaleString('ru-RU')} руб.`,
      data: {
        totalValue,
        totalCost,
        totalProfit,
        profitPercentage
      },
      metrics: {
        portfolioValue: totalValue,
        totalReturn: profitPercentage,
        dailyReturn: 1.2, // Мок данные
        weeklyReturn: 3.5,
        monthlyReturn: 8.7,
        volatility: 12.3,
        maxDrawdown: -5.2,
        winRate: 65.4,
        profitFactor: 1.8
      },
      charts: [
        {
          type: 'PIE',
          title: 'Распределение активов',
          data: positions.map(pos => ({
            name: pos.assetSymbol,
            value: pos.currentValue
          }))
        }
      ]
    };
  }

  private async generateRiskAnalysis(positions: PortfolioPosition[]): Promise<ReportSection> {
    const riskLevels = {
      LOW: positions.filter(p => Math.abs(p.profitLossPercentage) < 5).length,
      MEDIUM: positions.filter(p => Math.abs(p.profitLossPercentage) >= 5 && Math.abs(p.profitLossPercentage) < 15).length,
      HIGH: positions.filter(p => Math.abs(p.profitLossPercentage) >= 15).length
    };

    return {
      title: 'Анализ рисков',
      type: 'RISK_ANALYSIS',
      content: 'Оценка текущих рисков портфеля и рекомендации по управлению',
      data: {
        riskDistribution: riskLevels,
        concentrationRisk: this.calculateConcentrationRisk(positions),
        marketRisk: 'MEDIUM',
        liquidityRisk: 'LOW'
      },
      riskAssessment: {
        overallRiskLevel: 'medium',
        portfolioRiskScore: 65,
        diversificationScore: 0.7,
        concentrationRisk: 0.25,
        volatilityRisk: 0.4,
        recommendations: riskLevels.HIGH > 2 ? [
          {
            type: 'diversification',
            priority: 'high',
            title: 'Диверсифицировать портфель',
            description: 'Высокая концентрация рисковых активов',
            action: 'Добавить новые активы в портфель'
          }
        ] : [],
        warnings: riskLevels.HIGH > 2 ? [
          {
            type: 'concentration',
            severity: 'warning',
            title: 'Высокая концентрация риска',
            description: 'Один актив составляет значительную часть портфеля',
            affectedAsset: positions[0]?.assetSymbol
          }
        ] : []
      },
      charts: [
        {
          type: 'GAUGE',
          title: 'Уровень риска портфеля',
          data: [{ value: 65, max: 100 }]
        }
      ]
    };
  }

  private async generateRecommendations(positions: PortfolioPosition[]): Promise<ReportSection> {
    const recommendations: ReportRecommendation[] = [];

    // Анализ позиций и генерация рекомендаций
    positions.forEach(position => {
      if (position.profitLossPercentage > 20) {
        recommendations.push({
          type: 'SELL',
          assetSymbol: position.assetSymbol,
          assetName: position.assetSymbol,
          confidence: 75,
          reason: 'Высокая прибыль, возможна коррекция',
          action: 'Частичная фиксация прибыли',
          timeframe: 'SHORT_TERM',
          priority: 'MEDIUM'
        });
      } else if (position.profitLossPercentage < -10) {
        recommendations.push({
          type: 'HOLD',
          assetSymbol: position.assetSymbol,
          assetName: position.assetSymbol,
          confidence: 60,
          reason: 'Временная коррекция, потенциал восстановления',
          action: 'Дождаться отскока',
          timeframe: 'MEDIUM_TERM',
          priority: 'LOW'
        });
      }
    });

    // Рекомендация по диверсификации
    if (positions.length < 5) {
      recommendations.push({
        type: 'DIVERSIFY',
        assetSymbol: 'PORTFOLIO',
        assetName: 'Портфель',
        confidence: 85,
        reason: 'Низкая диверсификация портфеля',
        action: 'Добавить новые активы для снижения риска',
        timeframe: 'MEDIUM_TERM',
        priority: 'HIGH'
      });
    }

    return {
      title: 'Торговые рекомендации',
      type: 'RECOMMENDATIONS',
      content: 'Персональные рекомендации по управлению портфелем',
      data: { recommendations },
      recommendations
    };
  }

  private generateSummary(market: ReportSection, portfolio: ReportSection, risk: ReportSection): string {
    const profit = (portfolio.data as any).profitPercentage || 0;
    const riskLevel = risk.riskAssessment?.overallRiskLevel || 'medium';

    if (profit > 5 && riskLevel === 'low') {
      return 'Отличные результаты! Портфель показывает стабильный рост при низком уровне риска.';
    } else if (profit > 0 && riskLevel === 'medium') {
      return 'Хорошие результаты. Рекомендуется обратить внимание на управление рисками.';
    } else {
      return 'Требуется оптимизация портфеля. Рассмотрите рекомендации по снижению рисков.';
    }
  }

  private calculateConcentrationRisk(positions: PortfolioPosition[]): string {
    if (positions.length === 0) return 'LOW';
    
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const maxPosition = Math.max(...positions.map(pos => pos.currentValue));
    const concentration = (maxPosition / totalValue) * 100;

    if (concentration > 50) return 'VERY_HIGH';
    if (concentration > 30) return 'HIGH';
    if (concentration > 15) return 'MEDIUM';
    return 'LOW';
  }

  private generateMockChartData(): any[] {
    return Array.from({ length: 10 }, (_, i) => ({
      time: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU'),
      value: 3000 + Math.random() * 500
    }));
  }

  // Заглушки для остальных методов
  private async generateWeeklySections(positions: PortfolioPosition[]): Promise<ReportSection[]> {
    return [
      await this.generateMarketOverview(),
      await this.generatePortfolioPerformance(positions),
      await this.generateRiskAnalysis(positions)
    ];
  }

  private async generateWeeklyRecommendations(positions: PortfolioPosition[]): Promise<ReportRecommendation[]> {
    const section = await this.generateRecommendations(positions);
    return section.recommendations || [];
  }

  private async generateWeeklyRiskAssessment(positions: PortfolioPosition[]): Promise<RiskAssessment> {
    const section = await this.generateRiskAnalysis(positions);
    return section.riskAssessment!;
  }

  private async calculateWeeklyMetrics(positions: PortfolioPosition[]): Promise<PerformanceMetrics> {
    const section = await this.generatePortfolioPerformance(positions);
    return section.metrics!;
  }

  private async generatePortfolioSections(positions: PortfolioPosition[]): Promise<ReportSection[]> {
    return [
      await this.generateMarketOverview(),
      await this.generatePortfolioPerformance(positions),
      await this.generateRiskAnalysis(positions),
      await this.generateRecommendations(positions)
    ];
  }

  private async generatePortfolioRecommendations(positions: PortfolioPosition[]): Promise<ReportRecommendation[]> {
    const section = await this.generateRecommendations(positions);
    return section.recommendations || [];
  }

  private async generatePortfolioRiskAssessment(positions: PortfolioPosition[]): Promise<RiskAssessment> {
    const section = await this.generateRiskAnalysis(positions);
    return section.riskAssessment!;
  }

  private async calculatePortfolioMetrics(positions: PortfolioPosition[]): Promise<PerformanceMetrics> {
    const section = await this.generatePortfolioPerformance(positions);
    return section.metrics!;
  }
}

export default AnalyticsReportService;