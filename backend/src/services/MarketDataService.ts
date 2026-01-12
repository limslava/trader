import { Asset, PriceData, TechnicalIndicators, AssetType } from '../types/market';
import { MOEXDataSource } from '../data-sources/MOEXDataSource';
import { BinanceDataSource } from '../data-sources/BinanceDataSource';
import { TradingViewDataSource } from '../data-sources/TradingViewDataSource';

export class MarketDataService {
  private moexDataSource: MOEXDataSource;
  private binanceDataSource: BinanceDataSource;
  private tradingViewDataSource: TradingViewDataSource;
  private cache: Map<string, PriceData> = new Map();

  constructor() {
    this.moexDataSource = new MOEXDataSource();
    this.binanceDataSource = new BinanceDataSource();
    this.tradingViewDataSource = new TradingViewDataSource();
  }

  async getPrice(symbol: string, exchange?: string): Promise<PriceData | null> {
    const cacheKey = `${symbol}:${exchange || 'default'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < 30000) {
      return cached;
    }

    try {
      let priceData: PriceData | null = null;

      // Определяем источник данных по символу и бирже
      if (exchange === 'MOEX' || this.isRussianStock(symbol)) {
        priceData = await this.moexDataSource.getPrice(symbol);
      } else if (exchange === 'BINANCE' || this.isCrypto(symbol)) {
        priceData = await this.binanceDataSource.getPrice(symbol);
      } else {
        // Пробуем все источники
        priceData = await this.moexDataSource.getPrice(symbol) ||
                   await this.binanceDataSource.getPrice(symbol) ||
                   await this.tradingViewDataSource.getPrice(symbol);
      }

      if (priceData) {
        this.cache.set(cacheKey, priceData);
      }

      return priceData;
    } catch (error) {
      console.error(`Ошибка получения цены для ${symbol}:`, error);
      return null;
    }
  }

  async getMultiplePrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const results = new Map<string, PriceData>();
    
    // Получаем цены параллельно для оптимизации
    const promises = symbols.map(async (symbol) => {
      const priceData = await this.getPrice(symbol);
      if (priceData) {
        results.set(symbol, priceData);
      }
    });

    await Promise.all(promises);
    return results;
  }

  async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null> {
    try {
      return await this.tradingViewDataSource.getTechnicalIndicators(symbol);
    } catch (error) {
      console.error(`Ошибка получения технических индикаторов для ${symbol}:`, error);
      return null;
    }
  }

  async getPopularRussianStocks(): Promise<Asset[]> {
    // Популярные российские акции для новичков
    const popularStocks = [
      { symbol: 'SBER', name: 'Сбербанк' },
      { symbol: 'GAZP', name: 'Газпром' },
      { symbol: 'LKOH', name: 'Лукойл' },
      { symbol: 'ROSN', name: 'Роснефть' },
      { symbol: 'VTBR', name: 'ВТБ' },
      { symbol: 'GMKN', name: 'Норникель' },
      { symbol: 'NLMK', name: 'НЛМК' },
      { symbol: 'PLZL', name: 'Полюс' },
      { symbol: 'TATN', name: 'Татнефть' },
      { symbol: 'MGNT', name: 'Магнит' }
    ];

    // Получаем актуальные цены
    const pricePromises = popularStocks.map(async (stock) => {
      const priceData = await this.getPrice(stock.symbol, 'MOEX');
      return {
        id: `MOEX:${stock.symbol}`,
        symbol: stock.symbol,
        name: stock.name,
        type: 'STOCK' as AssetType,
        exchange: 'MOEX' as const,
        currentPrice: priceData?.price || 0,
        priceChange: priceData?.change || 0,
        priceChangePercent: priceData?.changePercent || 0,
        volume: priceData?.volume || 0,
        lastUpdated: priceData?.timestamp || new Date()
      };
    });

    return Promise.all(pricePromises);
  }

  async getPopularCryptos(): Promise<Asset[]> {
    // Популярные криптовалюты доступные в РФ
    const popularCryptos = [
      { symbol: 'BTCUSDT', name: 'Bitcoin' },
      { symbol: 'ETHUSDT', name: 'Ethereum' },
      { symbol: 'BNBUSDT', name: 'Binance Coin' },
      { symbol: 'ADAUSDT', name: 'Cardano' },
      { symbol: 'DOTUSDT', name: 'Polkadot' },
      { symbol: 'LINKUSDT', name: 'Chainlink' },
      { symbol: 'LTCUSDT', name: 'Litecoin' },
      { symbol: 'BCHUSDT', name: 'Bitcoin Cash' },
      { symbol: 'XRPUSDT', name: 'Ripple' },
      { symbol: 'EOSUSDT', name: 'EOS' }
    ];

    // Получаем актуальные цены
    const pricePromises = popularCryptos.map(async (crypto) => {
      const priceData = await this.getPrice(crypto.symbol, 'BINANCE');
      return {
        id: `BINANCE:${crypto.symbol}`,
        symbol: crypto.symbol,
        name: crypto.name,
        type: 'CRYPTO' as AssetType,
        exchange: 'BINANCE' as const,
        currentPrice: priceData?.price || 0,
        priceChange: priceData?.change || 0,
        priceChangePercent: priceData?.changePercent || 0,
        volume: priceData?.volume || 0,
        lastUpdated: priceData?.timestamp || new Date()
      };
    });

    return Promise.all(pricePromises);
  }

  async updateMarketData(): Promise<void> {
    // Обновление кэша данных для популярных активов
    const popularStocks = await this.getPopularRussianStocks();
    const popularCryptos = await this.getPopularCryptos();
    
    const allSymbols = [
      ...popularStocks.map(stock => stock.symbol),
      ...popularCryptos.map(crypto => crypto.symbol)
    ];

    await this.getMultiplePrices(allSymbols);
    console.log(`Обновлены данные для ${allSymbols.length} активов`);
  }

  private isRussianStock(symbol: string): boolean {
    const russianSymbols = ['SBER', 'GAZP', 'LKOH', 'ROSN', 'VTBR', 'GMKN', 'NLMK', 'PLZL', 'TATN', 'MGNT'];
    return russianSymbols.includes(symbol.toUpperCase());
  }

  private isCrypto(symbol: string): boolean {
    return symbol.includes('USDT') || symbol.includes('BTC') || symbol.includes('ETH');
  }
}