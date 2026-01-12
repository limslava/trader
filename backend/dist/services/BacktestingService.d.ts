export interface BacktestResult {
    strategy: string;
    symbol: string;
    timeframe: string;
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    totalTrades: number;
    profitableTrades: number;
    startDate: Date;
    endDate: Date;
    trades: Trade[];
    equityCurve: Array<{
        date: Date;
        equity: number;
    }>;
}
export interface Trade {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    entryDate: Date;
    exitDate: Date;
    pnl: number;
    pnlPercent: number;
    duration: number;
}
export interface StrategyConfig {
    name: string;
    symbol: string;
    timeframe: string;
    initialCapital: number;
    riskPerTrade: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    rsiOverbought: number;
    rsiOversold: number;
    movingAveragePeriod: number;
}
export declare class BacktestingService {
    private cacheService;
    constructor();
    backtestRSIStrategy(config: StrategyConfig): Promise<BacktestResult>;
    backtestMAStrategy(config: StrategyConfig): Promise<BacktestResult>;
    compareStrategies(strategies: string[], config: StrategyConfig): Promise<Array<{
        strategy: string;
        result: BacktestResult;
    }>>;
    private executeRSIBacktest;
    private executeMABacktest;
    private backtestMACDStrategy;
    private calculateBacktestResult;
    private calculateRSI;
    private calculateMovingAverage;
    private generateHistoricalData;
    private getBasePrice;
}
//# sourceMappingURL=BacktestingService.d.ts.map