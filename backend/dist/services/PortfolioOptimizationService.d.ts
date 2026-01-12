export interface AssetAllocation {
    symbol: string;
    targetWeight: number;
    currentWeight: number;
    recommendedAction: 'BUY' | 'SELL' | 'HOLD';
    quantityToTrade: number;
    expectedReturn: number;
    risk: number;
    sharpeRatio: number;
}
export interface PortfolioOptimizationResult {
    optimizedAllocation: AssetAllocation[];
    expectedPortfolioReturn: number;
    expectedPortfolioRisk: number;
    sharpeRatio: number;
    efficientFrontier: Array<{
        return: number;
        risk: number;
    }>;
    rebalancingNeeded: boolean;
    totalRebalancingCost: number;
}
export interface HistoricalData {
    symbol: string;
    returns: number[];
    prices: number[];
    volatility: number;
    averageReturn: number;
}
export declare class PortfolioOptimizationService {
    private cacheService;
    constructor();
    optimizePortfolio(currentPositions: Array<{
        symbol: string;
        quantity: number;
        currentPrice: number;
    }>, totalPortfolioValue: number, riskTolerance?: 'LOW' | 'MEDIUM' | 'HIGH', optimizationMethod?: 'MARKOWITZ' | 'BLACK_LITTERMAN' | 'RISK_PARITY'): Promise<PortfolioOptimizationResult>;
    private markowitzOptimization;
    private blackLittermanOptimization;
    private riskParityOptimization;
    private calculateCovarianceMatrix;
    private calculateCorrelationMatrix;
    private solveMarkowitzOptimization;
    private calculateRiskParityWeights;
    private buildOptimizationResult;
    private getTargetReturn;
    private getAssetCorrelation;
    private getHistoricalDataForAssets;
    private generateInvestorViews;
    private blendEquilibriumAndViews;
    private generateEfficientFrontier;
    private calculateRebalancingCost;
    private getCurrentPrice;
}
//# sourceMappingURL=PortfolioOptimizationService.d.ts.map