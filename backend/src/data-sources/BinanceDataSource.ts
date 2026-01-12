import { PriceData, TechnicalIndicators } from '../types/market';

export class BinanceDataSource {
  private baseUrl = 'https://api.binance.com/api/v3';
  private cache: Map<string, PriceData> = new Map();

  async getPrice(symbol: string): Promise<PriceData | null> {
    try {
      // Для демонстрации используем мок-данные
      // В реальном приложении здесь будет запрос к Binance API
      const mockPrice = this.generateMockCryptoPrice(symbol);
      
      if (mockPrice) {
        this.cache.set(symbol, mockPrice);
        return mockPrice;
      }

      return null;
    } catch (error) {
      console.error(`Ошибка получения цены Binance для ${symbol}:`, error);
      return null;
    }
  }

  async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null> {
    // Мок-данные для технических индикаторов крипты
    return {
      rsi: 30 + Math.random() * 40, // Более волатильные значения для крипты
      macd: {
        macd: (Math.random() - 0.5) * 10,
        signal: (Math.random() - 0.5) * 8,
        histogram: (Math.random() - 0.5) * 2
      },
      movingAverages: {
        sma20: this.getCryptoBasePrice(symbol) * (1 + (Math.random() - 0.5) * 0.1),
        sma50: this.getCryptoBasePrice(symbol) * (1 + (Math.random() - 0.5) * 0.15),
        sma200: this.getCryptoBasePrice(symbol) * (1 + (Math.random() - 0.5) * 0.2)
      },
      support: this.getCryptoBasePrice(symbol) * 0.9,
      resistance: this.getCryptoBasePrice(symbol) * 1.1
    };
  }

  private generateMockCryptoPrice(symbol: string): PriceData | null {
    const basePrice = this.getCryptoBasePrice(symbol);
    if (!basePrice) return null;

    // Крипта более волатильна
    const changePercent = (Math.random() - 0.5) * 10; // -5% to +5%
    const price = basePrice * (1 + changePercent / 100);
    const change = price - basePrice;
    const volume = Math.floor(Math.random() * 10000000) + 1000000;

    return {
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume,
      timestamp: new Date()
    };
  }

  private getCryptoBasePrice(symbol: string): number {
    const basePrices: { [key: string]: number } = {
      'BTCUSDT': 45000,
      'ETHUSDT': 2500,
      'BNBUSDT': 300,
      'ADAUSDT': 0.5,
      'DOTUSDT': 7,
      'LINKUSDT': 15,
      'LTCUSDT': 70,
      'BCHUSDT': 250,
      'XRPUSDT': 0.6,
      'EOSUSDT': 0.8
    };

    return basePrices[symbol] || 0;
  }

  async getCryptoMarketStats(): Promise<any> {
    // Статистика по крипторынку
    return {
      totalMarketCap: Math.floor(Math.random() * 2000000000000),
      bitcoinDominance: 40 + Math.random() * 10,
      fearGreedIndex: Math.floor(Math.random() * 100),
      totalVolume24h: Math.floor(Math.random() * 100000000000)
    };
  }

  async getCryptoNews(): Promise<any[]> {
    // Мок-новости по крипте
    return [
      {
        title: 'Bitcoin показывает рост на фоне институционального интереса',
        source: 'CryptoNews',
        publishedAt: new Date(Date.now() - 3600000),
        sentiment: 75
      },
      {
        title: 'Ethereum готовится к обновлению сети',
        source: 'CoinDesk',
        publishedAt: new Date(Date.now() - 7200000),
        sentiment: 60
      },
      {
        title: 'Регуляторы обсуждают новые правила для крипторынка',
        source: 'Reuters',
        publishedAt: new Date(Date.now() - 10800000),
        sentiment: -30
      }
    ];
  }
}