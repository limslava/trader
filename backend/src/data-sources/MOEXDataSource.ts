import { PriceData, TechnicalIndicators } from '../types/market';

export class MOEXDataSource {
  private baseUrl = 'https://iss.moex.com/iss';
  private cache: Map<string, PriceData> = new Map();

  async getPrice(symbol: string): Promise<PriceData | null> {
    try {
      // Для демонстрации используем мок-данные
      // В реальном приложении здесь будет запрос к MOEX API
      const mockPrice = this.generateMockPrice(symbol);
      
      if (mockPrice) {
        this.cache.set(symbol, mockPrice);
        return mockPrice;
      }

      return null;
    } catch (error) {
      console.error(`Ошибка получения цены MOEX для ${symbol}:`, error);
      return null;
    }
  }

  async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null> {
    // Мок-данные для технических индикаторов
    return {
      rsi: Math.random() * 100,
      macd: {
        macd: (Math.random() - 0.5) * 2,
        signal: (Math.random() - 0.5) * 1.5,
        histogram: (Math.random() - 0.5) * 0.5
      },
      movingAverages: {
        sma20: 100 + (Math.random() - 0.5) * 10,
        sma50: 100 + (Math.random() - 0.5) * 15,
        sma200: 100 + (Math.random() - 0.5) * 20
      },
      support: 95 + Math.random() * 5,
      resistance: 105 + Math.random() * 5
    };
  }

  private generateMockPrice(symbol: string): PriceData | null {
    const basePrices: { [key: string]: number } = {
      'SBER': 300,
      'GAZP': 180,
      'LKOH': 7500,
      'ROSN': 550,
      'VTBR': 0.03,
      'GMKN': 16000,
      'NLMK': 150,
      'PLZL': 11000,
      'TATN': 400,
      'MGNT': 5000
    };

    const basePrice = basePrices[symbol];
    if (!basePrice) return null;

    const changePercent = (Math.random() - 0.5) * 4; // -2% to +2%
    const price = basePrice * (1 + changePercent / 100);
    const change = price - basePrice;
    const volume = Math.floor(Math.random() * 1000000) + 100000;

    return {
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume,
      timestamp: new Date()
    };
  }

  async getMarketStats(): Promise<any> {
    // Статистика по рынку MOEX
    return {
      totalVolume: Math.floor(Math.random() * 1000000000),
      advancing: Math.floor(Math.random() * 100),
      declining: Math.floor(Math.random() * 100),
      unchanged: Math.floor(Math.random() * 50),
      indexValue: 3200 + (Math.random() - 0.5) * 100
    };
  }
}