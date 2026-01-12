interface RiskAssessment {
    overallRiskLevel: string;
    portfolioRiskScore: number;
    diversificationScore: number;
    concentrationRisk: number;
    volatilityRisk: number;
    recommendations: any[];
    warnings: any[];
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
export declare class AnalyticsReportService {
    private reports;
    generateDailyReport(userId: string, portfolioPositions: PortfolioPosition[]): Promise<AnalyticsReport>;
    generateWeeklyReport(userId: string, portfolioPositions: PortfolioPosition[]): Promise<AnalyticsReport>;
    generatePortfolioReport(userId: string, portfolioPositions: PortfolioPosition[]): Promise<AnalyticsReport>;
    getReport(reportId: string): Promise<AnalyticsReport | null>;
    getUserReports(userId: string): Promise<AnalyticsReport[]>;
    cleanupExpiredReports(): Promise<void>;
    private generateMarketOverview;
    private generatePortfolioPerformance;
    private generateRiskAnalysis;
    private generateRecommendations;
    private generateSummary;
    private calculateConcentrationRisk;
    private generateMockChartData;
    private generateWeeklySections;
    private generateWeeklyRecommendations;
    private generateWeeklyRiskAssessment;
    private calculateWeeklyMetrics;
    private generatePortfolioSections;
    private generatePortfolioRecommendations;
    private generatePortfolioRiskAssessment;
    private calculatePortfolioMetrics;
}
export default AnalyticsReportService;
//# sourceMappingURL=AnalyticsReportService.d.ts.map