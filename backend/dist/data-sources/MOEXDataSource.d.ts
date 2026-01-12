import { PriceData, TechnicalIndicators } from '../types/market';
export declare class MOEXDataSource {
    private baseUrl;
    private cache;
    getPrice(symbol: string): Promise<PriceData | null>;
    getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null>;
    private generateMockPrice;
    getMarketStats(): Promise<any>;
}
//# sourceMappingURL=MOEXDataSource.d.ts.map