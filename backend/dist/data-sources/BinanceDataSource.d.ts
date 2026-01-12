import { PriceData, TechnicalIndicators } from '../types/market';
export declare class BinanceDataSource {
    private baseUrl;
    private cache;
    getPrice(symbol: string): Promise<PriceData | null>;
    getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null>;
    private generateMockCryptoPrice;
    private getCryptoBasePrice;
    getCryptoMarketStats(): Promise<any>;
    getCryptoNews(): Promise<any[]>;
}
//# sourceMappingURL=BinanceDataSource.d.ts.map