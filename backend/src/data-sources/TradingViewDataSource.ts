import { PriceData, TechnicalIndicators } from '../types/market';

export class TradingViewDataSource {
  private cache: Map<string, TechnicalIndicators> = new Map();

  async getPrice(symbol: string): Promise<PriceData | null> {
    // TradingView обычно не предоставляет прямого API для цен
    // В реальном приложении можно использовать их WebSocket или парсить данные
    return null;
  }

  async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null> {
    const cacheKey = `${symbol}:indicators`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - new Date().getTime() < 60000) {
      return cached;
    }

    try {
      // Генерируем реалистичные технические индикаторы
      const indicators = this.generateRealisticIndicators(symbol);
      this.cache.set(cacheKey, indicators);
      return indicators;
    } catch (error) {
      console.error(`Ошибка получения индикаторов TradingView для ${symbol}:`, error);
      return null;
    }
  }

  private generateRealisticIndicators(symbol: string): TechnicalIndicators {
    const isCrypto = symbol.includes('USDT');
    
    // Более реалистичные значения индикаторов
    const baseRSI = 50 + (Math.random() - 0.5) * 30;
    const rsi = Math.max(0, Math.min(100, baseRSI));

    // MACD с реалистичной логикой
    const macdValue = (Math.random() - 0.5) * (isCrypto ? 2 : 0.5);
    const signalValue = macdValue * 0.8 + (Math.random() - 0.5) * 0.1;
    const histogram = macdValue - signalValue;

    const basePrice = this.getSymbolBasePrice(symbol);
    const volatility = isCrypto ? 0.1 : 0.03; // Крипта более волатильна

    return {
      rsi,
      macd: {
        macd: Math.round(macdValue * 100) / 100,
        signal: Math.round(signalValue * 100) / 100,
        histogram: Math.round(histogram * 100) / 100
      },
      movingAverages: {
        sma20: basePrice * (1 + (Math.random() - 0.5) * volatility),
        sma50: basePrice * (1 + (Math.random() - 0.5) * volatility * 1.2),
        sma200: basePrice * (1 + (Math.random() - 0.5) * volatility * 1.5)
      },
      support: basePrice * (1 - volatility * 0.8),
      resistance: basePrice * (1 + volatility * 0.8),
    };
  }

  private getSymbolBasePrice(symbol: string): number {
    // Базовые цены для расчета индикаторов
    const stockPrices: { [key: string]: number } = {
      'SBER': 300, 'GAZP': 180, 'LKOH': 7500, 'ROSN': 550, 'VTBR': 0.03,
      'GMKN': 16000, 'NLMK': 150, 'PLZL': 11000, 'TATN': 400, 'MGNT': 5000
    };

    const cryptoPrices: { [key: string]: number } = {
      'BTCUSDT': 45000, 'ETHUSDT': 2500, 'BNBUSDT': 300, 'ADAUSDT': 0.5,
      'DOTUSDT': 7, 'LINKUSDT': 15, 'LTCUSDT': 70, 'BCHUSDT': 250,
      'XRPUSDT': 0.6, 'EOSUSDT': 0.8
    };

    return stockPrices[symbol] || cryptoPrices[symbol] || 100;
  }

  async getMarketAnalysis(symbol: string): Promise<{
    summary: string;
    signals: string[];
    timeframe: string;
  }> {
    const signals = [];
    const indicators = await this.getTechnicalIndicators(symbol);

    if (!indicators) {
      return {
        summary: 'Недостаточно данных для анализа',
        signals: [],
        timeframe: '1D'
      };
    }

    // Генерируем сигналы на основе индикаторов
    if (indicators.rsi && indicators.rsi < 30) {
      signals.push('RSI показывает перепроданность');
    } else if (indicators.rsi && indicators.rsi > 70) {
      signals.push('RSI показывает перекупленность');
    }

    if (indicators.macd && indicators.macd.macd > indicators.macd.signal) {
      signals.push('MACD показывает бычий сигнал');
    } else if (indicators.macd && indicators.macd.macd < indicators.macd.signal) {
      signals.push('MACD показывает медвежий сигнал');
    }

    const sma20 = indicators.movingAverages?.sma20 || 0;
    const sma50 = indicators.movingAverages?.sma50 || 0;
    
    if (sma20 > sma50) {
      signals.push('Краткосрочный тренд восходящий');
    } else {
      signals.push('Краткосрочный тренд нисходящий');
    }

    const summary = signals.length > 0 
      ? `На основе технического анализа выявлено ${signals.length} сигналов`
      : 'Рынок находится в нейтральной зоне';

    return {
      summary,
      signals,
      timeframe: '1D'
    };
  }

  async getScreenerResults(filters: any): Promise<any[]> {
    // Мок-данные для скринера акций/крипты
    return [
      {
        symbol: 'SBER',
        name: 'Сбербанк',
        price: 300 + (Math.random() - 0.5) * 10,
        changePercent: (Math.random() - 0.5) * 4,
        volume: Math.floor(Math.random() * 1000000),
        rsi: 50 + (Math.random() - 0.5) * 20,
        recommendation: Math.random() > 0.5 ? 'BUY' : 'HOLD'
      },
      {
        symbol: 'GAZP',
        name: 'Газпром',
        price: 180 + (Math.random() - 0.5) * 5,
        changePercent: (Math.random() - 0.5) * 3,
        volume: Math.floor(Math.random() * 800000),
        rsi: 50 + (Math.random() - 0.5) * 25,
        recommendation: Math.random() > 0.6 ? 'BUY' : 'HOLD'
      }
    ];
  }
}