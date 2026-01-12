"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachedMarketDataService = exports.CachedMarketDataService = void 0;
const MarketDataService_1 = require("./MarketDataService");
const MemoryCacheService_1 = require("./MemoryCacheService");
class CachedMarketDataService {
    constructor(marketDataService, cacheTtl = 30) {
        this.marketDataService = marketDataService;
        this.cacheTtl = cacheTtl;
    }
    async getPrice(symbol) {
        const cacheKey = `price:${symbol}`;
        const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
        if (cached) {
            console.log(`📊 Цена ${symbol} получена из кэша`);
            return cached;
        }
        const priceData = await this.marketDataService.getPrice(symbol);
        if (!priceData) {
            return null;
        }
        const cachedData = {
            price: priceData.price,
            change: priceData.change,
            changePercent: priceData.changePercent,
            volume: priceData.volume,
            timestamp: Date.now()
        };
        await MemoryCacheService_1.memoryCacheService.set(cacheKey, cachedData, { ttl: this.cacheTtl });
        console.log(`📊 Цена ${symbol} сохранена в кэш`);
        return cachedData;
    }
    async getPrices(symbols) {
        const result = {};
        const symbolsToFetch = [];
        for (const symbol of symbols) {
            const cacheKey = `price:${symbol}`;
            const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
            if (cached) {
                result[symbol] = cached;
                console.log(`📊 Цена ${symbol} получена из кэша (batch)`);
            }
            else {
                symbolsToFetch.push(symbol);
            }
        }
        if (symbolsToFetch.length === 0) {
            return result;
        }
        const fetchedPrices = await this.marketDataService.getMultiplePrices(symbolsToFetch);
        for (const symbol of symbolsToFetch) {
            const priceData = fetchedPrices.get(symbol);
            if (priceData) {
                const cachedData = {
                    price: priceData.price,
                    change: priceData.change,
                    changePercent: priceData.changePercent,
                    volume: priceData.volume,
                    timestamp: Date.now()
                };
                const cacheKey = `price:${symbol}`;
                await MemoryCacheService_1.memoryCacheService.set(cacheKey, cachedData, { ttl: this.cacheTtl });
                result[symbol] = cachedData;
                console.log(`📊 Цена ${symbol} сохранена в кэш (batch)`);
            }
        }
        return result;
    }
    async getPopularStocks() {
        const cacheKey = 'popular:stocks';
        const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
        if (cached) {
            console.log('📊 Популярные акции получены из кэша');
            return cached;
        }
        const stocks = await this.marketDataService.getPopularRussianStocks();
        await MemoryCacheService_1.memoryCacheService.set(cacheKey, stocks, { ttl: 300 });
        console.log('📊 Популярные акции сохранены в кэш');
        return stocks;
    }
    async getPopularCrypto() {
        const cacheKey = 'popular:crypto';
        const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
        if (cached) {
            console.log('📊 Популярные криптовалюты получены из кэша');
            return cached;
        }
        const crypto = await this.marketDataService.getPopularCryptos();
        await MemoryCacheService_1.memoryCacheService.set(cacheKey, crypto, { ttl: 300 });
        console.log('📊 Популярные криптовалюты сохранены в кэш');
        return crypto;
    }
    async getHistoricalData(symbol, period = '1d') {
        const cacheKey = `history:${symbol}:${period}`;
        const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
        if (cached) {
            console.log(`📊 Исторические данные ${symbol} (${period}) получены из кэша`);
            return cached;
        }
        const historicalData = [];
        await MemoryCacheService_1.memoryCacheService.set(cacheKey, historicalData, { ttl: 600 });
        console.log(`📊 Исторические данные ${symbol} (${period}) сохранены в кэш`);
        return historicalData;
    }
    async invalidateSymbolCache(symbol) {
        const priceKey = `price:${symbol}`;
        const historyKeyPattern = `history:${symbol}:*`;
        await MemoryCacheService_1.memoryCacheService.delete(priceKey);
        await MemoryCacheService_1.memoryCacheService.clearPattern(historyKeyPattern);
        console.log(`🗑️ Кэш для ${symbol} очищен`);
    }
    async invalidateAllCache() {
        const patterns = ['price:*', 'popular:*', 'history:*'];
        for (const pattern of patterns) {
            await MemoryCacheService_1.memoryCacheService.clearPattern(pattern);
        }
        console.log('🗑️ Весь кэш рыночных данных очищен');
    }
    async getCacheStats() {
        const priceKeys = await MemoryCacheService_1.memoryCacheService.keys('price:*');
        const popularKeys = await MemoryCacheService_1.memoryCacheService.keys('popular:*');
        const historyKeys = await MemoryCacheService_1.memoryCacheService.keys('history:*');
        return {
            totalKeys: priceKeys.length + popularKeys.length + historyKeys.length,
            priceKeys: priceKeys.length,
            popularKeys: popularKeys.length,
            historyKeys: historyKeys.length
        };
    }
    async getKeyTtl(key) {
        return await MemoryCacheService_1.memoryCacheService.ttl(key);
    }
}
exports.CachedMarketDataService = CachedMarketDataService;
exports.cachedMarketDataService = new CachedMarketDataService(new MarketDataService_1.MarketDataService());
//# sourceMappingURL=CachedMarketDataService.js.map