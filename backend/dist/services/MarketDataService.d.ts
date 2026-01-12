import { Asset, PriceData, TechnicalIndicators } from '../types/market';
export declare class MarketDataService {
    private moexDataSource;
    private binanceDataSource;
    private tradingViewDataSource;
    private cache;
    constructor();
    getPrice(symbol: string, exchange?: string): Promise<PriceData | null>;
    getMultiplePrices(symbols: string[]): Promise<Map<string, PriceData>>;
    getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null>;
    getPopularRussianStocks(): Promise<Asset[]>;
    getPopularCryptos(): Promise<Asset[]>;
    updateMarketData(): Promise<void>;
    private isRussianStock;
    private isCrypto;
}
//# sourceMappingURL=MarketDataService.d.ts.map