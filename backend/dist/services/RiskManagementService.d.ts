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
export declare class RiskManagementService {
    private portfolioService;
    private marketDataService;
    constructor();
    assessPortfolioRisk(userId: string): Promise<RiskAssessment>;
    getStopLossRecommendations(userId: string): Promise<StopLossRecommendation[]>;
    calculateMaxPositionSize(totalPortfolioValue: number, riskTolerance?: 'low' | 'medium' | 'high'): number;
    private calculateStopLossPercentage;
    private getAssetRiskLevel;
    private calculateDiversificationScore;
    private calculateConcentrationRisk;
    private calculateVolatilityRisk;
    private checkStopLosses;
    private checkPositionSizes;
    private calculateOverallRiskLevel;
    private calculateRiskScore;
    private createDiversificationRecommendation;
    private createConcentrationWarning;
}
//# sourceMappingURL=RiskManagementService.d.ts.map