import { PriceData, TechnicalIndicators } from '../types/market';
export declare class TradingViewDataSource {
    private cache;
    getPrice(symbol: string): Promise<PriceData | null>;
    getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null>;
    private generateRealisticIndicators;
    private getSymbolBasePrice;
    getMarketAnalysis(symbol: string): Promise<{
        summary: string;
        signals: string[];
        timeframe: string;
    }>;
    getScreenerResults(filters: any): Promise<any[]>;
}
//# sourceMappingURL=TradingViewDataSource.d.ts.map