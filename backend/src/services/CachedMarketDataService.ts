import { MarketDataService } from './MarketDataService';
import { memoryCacheService } from './MemoryCacheService';

export interface CachedPriceData {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

export class CachedMarketDataService {
  private marketDataService: MarketDataService;
  private cacheTtl: number;

  constructor(marketDataService: MarketDataService, cacheTtl: number = 30) {
    this.marketDataService = marketDataService;
    this.cacheTtl = cacheTtl; // TTL в секундах
  }

  /**
   * Получить цену актива с кэшированием
   */
  async getPrice(symbol: string): Promise<CachedPriceData | null> {
    const cacheKey = `price:${symbol}`;
    
    // Попробовать получить из кэша
    const cached = await memoryCacheService.get<CachedPriceData>(cacheKey);
    if (cached) {
      console.log(`📊 Цена ${symbol} получена из кэша`);
      return cached;
    }

    // Получить из основного сервиса
    const priceData = await this.marketDataService.getPrice(symbol);
    if (!priceData) {
      return null;
    }

    const cachedData: CachedPriceData = {
      price: priceData.price,
      change: priceData.change,
      changePercent: priceData.changePercent,
      volume: priceData.volume,
      timestamp: Date.now()
    };

    // Сохранить в кэш
    await memoryCacheService.set(cacheKey, cachedData, { ttl: this.cacheTtl });
    console.log(`📊 Цена ${symbol} сохранена в кэш`);

    return cachedData;
  }

  /**
   * Получить цены нескольких активов с кэшированием
   */
  async getPrices(symbols: string[]): Promise<Record<string, CachedPriceData>> {
    const result: Record<string, CachedPriceData> = {};
    const symbolsToFetch: string[] = [];

    // Сначала проверить кэш для всех символов
    for (const symbol of symbols) {
      const cacheKey = `price:${symbol}`;
      const cached = await memoryCacheService.get<CachedPriceData>(cacheKey);
      
      if (cached) {
        result[symbol] = cached;
        console.log(`📊 Цена ${symbol} получена из кэша (batch)`);
      } else {
        symbolsToFetch.push(symbol);
      }
    }

    // Если все данные в кэше, вернуть результат
    if (symbolsToFetch.length === 0) {
      return result;
    }

    // Получить недостающие данные из основного сервиса
    const fetchedPrices = await this.marketDataService.getMultiplePrices(symbolsToFetch);
    
    // Сохранить полученные данные в кэш
    for (const symbol of symbolsToFetch) {
      const priceData = fetchedPrices.get(symbol);
      if (priceData) {
        const cachedData: CachedPriceData = {
          price: priceData.price,
          change: priceData.change,
          changePercent: priceData.changePercent,
          volume: priceData.volume,
          timestamp: Date.now()
        };

        const cacheKey = `price:${symbol}`;
        await memoryCacheService.set(cacheKey, cachedData, { ttl: this.cacheTtl });
        result[symbol] = cachedData;
        console.log(`📊 Цена ${symbol} сохранена в кэш (batch)`);
      }
    }

    return result;
  }

  /**
   * Получить популярные акции с кэшированием
   */
  async getPopularStocks(): Promise<any[]> {
    const cacheKey = 'popular:stocks';
    
    const cached = await memoryCacheService.get<any[]>(cacheKey);
    if (cached) {
      console.log('📊 Популярные акции получены из кэша');
      return cached;
    }

    const stocks = await this.marketDataService.getPopularRussianStocks();
    
    // Сохранить в кэш на более долгий срок (5 минут)
    await memoryCacheService.set(cacheKey, stocks, { ttl: 300 });
    console.log('📊 Популярные акции сохранены в кэш');

    return stocks;
  }

  /**
   * Получить популярные криптовалюты с кэшированием
   */
  async getPopularCrypto(): Promise<any[]> {
    const cacheKey = 'popular:crypto';
    
    const cached = await memoryCacheService.get<any[]>(cacheKey);
    if (cached) {
      console.log('📊 Популярные криптовалюты получены из кэша');
      return cached;
    }

    const crypto = await this.marketDataService.getPopularCryptos();
    
    // Сохранить в кэш на более долгий срок (5 минут)
    await memoryCacheService.set(cacheKey, crypto, { ttl: 300 });
    console.log('📊 Популярные криптовалюты сохранены в кэш');

    return crypto;
  }

  /**
   * Получить исторические данные с кэшированием
   */
  async getHistoricalData(symbol: string, period: string = '1d'): Promise<any[]> {
    const cacheKey = `history:${symbol}:${period}`;
    
    const cached = await memoryCacheService.get<any[]>(cacheKey);
    if (cached) {
      console.log(`📊 Исторические данные ${symbol} (${period}) получены из кэша`);
      return cached;
    }

    // Для демо используем пустой массив, так как метод getHistoricalData не реализован
    const historicalData: any[] = [];
    
    // Сохранить в кэш на 10 минут для исторических данных
    await memoryCacheService.set(cacheKey, historicalData, { ttl: 600 });
    console.log(`📊 Исторические данные ${symbol} (${period}) сохранены в кэш`);

    return historicalData;
  }

  /**
   * Инвалидировать кэш для конкретного символа
   */
  async invalidateSymbolCache(symbol: string): Promise<void> {
    const priceKey = `price:${symbol}`;
    const historyKeyPattern = `history:${symbol}:*`;
    
    await memoryCacheService.delete(priceKey);
    await memoryCacheService.clearPattern(historyKeyPattern);
    
    console.log(`🗑️ Кэш для ${symbol} очищен`);
  }

  /**
   * Инвалидировать весь кэш рыночных данных
   */
  async invalidateAllCache(): Promise<void> {
    const patterns = ['price:*', 'popular:*', 'history:*'];
    
    for (const pattern of patterns) {
      await memoryCacheService.clearPattern(pattern);
    }
    
    console.log('🗑️ Весь кэш рыночных данных очищен');
  }

  /**
   * Получить статистику кэша
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    priceKeys: number;
    popularKeys: number;
    historyKeys: number;
  }> {
    const priceKeys = await memoryCacheService.keys('price:*');
    const popularKeys = await memoryCacheService.keys('popular:*');
    const historyKeys = await memoryCacheService.keys('history:*');
    
    return {
      totalKeys: priceKeys.length + popularKeys.length + historyKeys.length,
      priceKeys: priceKeys.length,
      popularKeys: popularKeys.length,
      historyKeys: historyKeys.length
    };
  }

  /**
   * Получить TTL для ключа
   */
  async getKeyTtl(key: string): Promise<number> {
    return await memoryCacheService.ttl(key);
  }
}

// Глобальный экземпляр кэшированного сервиса рыночных данных
export const cachedMarketDataService = new CachedMarketDataService(
  new MarketDataService()
);