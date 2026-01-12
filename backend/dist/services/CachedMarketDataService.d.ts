import { MarketDataService } from './MarketDataService';
export interface CachedPriceData {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: number;
}
export declare class CachedMarketDataService {
    private marketDataService;
    private cacheTtl;
    constructor(marketDataService: MarketDataService, cacheTtl?: number);
    getPrice(symbol: string): Promise<CachedPriceData | null>;
    getPrices(symbols: string[]): Promise<Record<string, CachedPriceData>>;
    getPopularStocks(): Promise<any[]>;
    getPopularCrypto(): Promise<any[]>;
    getHistoricalData(symbol: string, period?: string): Promise<any[]>;
    invalidateSymbolCache(symbol: string): Promise<void>;
    invalidateAllCache(): Promise<void>;
    getCacheStats(): Promise<{
        totalKeys: number;
        priceKeys: number;
        popularKeys: number;
        historyKeys: number;
    }>;
    getKeyTtl(key: string): Promise<number>;
}
export declare const cachedMarketDataService: CachedMarketDataService;
//# sourceMappingURL=CachedMarketDataService.d.ts.map