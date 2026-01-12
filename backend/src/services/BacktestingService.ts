
import { MemoryCacheService } from './MemoryCacheService';

export interface BacktestResult {
  strategy: string;
  symbol: string;
  timeframe: string;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  startDate: Date;
  endDate: Date;
  trades: Trade[];
  equityCurve: Array<{ date: Date; equity: number }>;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryDate: Date;
  exitDate: Date;
  pnl: number;
  pnlPercent: number;
  duration: number; // в днях
}

export interface StrategyConfig {
  name: string;
  symbol: string;
  timeframe: string;
  initialCapital: number;
  riskPerTrade: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  rsiOverbought: number;
  rsiOversold: number;
  movingAveragePeriod: number;
}

export class BacktestingService {
  private cacheService: MemoryCacheService;

  constructor() {
    this.cacheService = new MemoryCacheService();
  }

  // Бэктестинг RSI стратегии
  async backtestRSIStrategy(config: StrategyConfig): Promise<BacktestResult> {
    const cacheKey = `backtest_rsi_${config.symbol}_${config.timeframe}_${config.initialCapital}`;
    
    try {
      // Проверяем кэш
      const cached = await this.cacheService.get<BacktestResult>(cacheKey);
      if (cached) {
        console.log(`📊 Бэктест RSI стратегии для ${config.symbol} загружен из кэша`);
        return cached;
      }

      // Генерируем исторические данные
      const historicalData = await this.generateHistoricalData(config.symbol, config.timeframe);
      
      // Выполняем бэктестинг
      const result = await this.executeRSIBacktest(historicalData, config);
      
      // Сохраняем в кэш на 1 час
      this.cacheService.set(cacheKey, result, { ttl: 3600 });
      
      console.log(`✅ Бэктест RSI стратегии завершен: доходность ${result.totalReturn.toFixed(2)}%`);
      return result;

    } catch (error) {
      console.error('❌ Ошибка бэктестинга RSI стратегии:', error);
      throw new Error('Не удалось выполнить бэктестинг стратегии');
    }
  }

  // Бэктестинг стратегии скользящих средних
  async backtestMAStrategy(config: StrategyConfig): Promise<BacktestResult> {
    const cacheKey = `backtest_ma_${config.symbol}_${config.timeframe}_${config.initialCapital}`;
    
    try {
      const cached = await this.cacheService.get<BacktestResult>(cacheKey);
      if (cached) {
        console.log(`📊 Бэктест MA стратегии для ${config.symbol} загружен из кэша`);
        return cached;
      }

      const historicalData = await this.generateHistoricalData(config.symbol, config.timeframe);
      const result = await this.executeMABacktest(historicalData, config);
      
      this.cacheService.set(cacheKey, result, { ttl: 3600 });
      
      console.log(`✅ Бэктест MA стратегии завершен: доходность ${result.totalReturn.toFixed(2)}%`);
      return result;

    } catch (error) {
      console.error('❌ Ошибка бэктестинга MA стратегии:', error);
      throw new Error('Не удалось выполнить бэктестинг стратегии');
    }
  }

  // Сравнение нескольких стратегий
  async compareStrategies(
    strategies: string[],
    config: StrategyConfig
  ): Promise<Array<{ strategy: string; result: BacktestResult }>> {
    
    const results = [];
    
    for (const strategy of strategies) {
      try {
        let result: BacktestResult;
        
        switch (strategy) {
          case 'RSI':
            result = await this.backtestRSIStrategy(config);
            break;
          case 'MA':
            result = await this.backtestMAStrategy(config);
            break;
          case 'MACD':
            result = await this.backtestMACDStrategy(config);
            break;
          default:
            throw new Error(`Неизвестная стратегия: ${strategy}`);
        }
        
        results.push({ strategy, result });
        
      } catch (error) {
        console.error(`❌ Ошибка бэктестинга стратегии ${strategy}:`, error);
      }
    }
    
    // Сортируем по доходности
    results.sort((a, b) => b.result.totalReturn - a.result.totalReturn);
    
    return results;
  }

  // Приватные методы реализации

  private async executeRSIBacktest(historicalData: any[], config: StrategyConfig): Promise<BacktestResult> {
    const trades: Trade[] = [];
    let capital = config.initialCapital;
    let position: { type: 'LONG' | 'SHORT'; entryPrice: number; quantity: number; entryDate: Date } | null = null;
    
    const equityCurve: Array<{ date: Date; equity: number }> = [];
    
    // Симуляция торговли
    for (let i = 50; i < historicalData.length; i++) { // Начинаем с 50-го дня для расчета индикаторов
      const currentData = historicalData[i]!;
      const previousData = historicalData[i - 1]!;
      
      // Расчет RSI
      const rsi = this.calculateRSI(historicalData.slice(i - 14, i + 1));
      
      // Логика входа/выхода
      if (!position) {
        // Сигнал на покупку: RSI перепроданность
        if (rsi < config.rsiOversold) {
          const riskAmount = capital * config.riskPerTrade;
          const quantity = Math.floor(riskAmount / currentData.price);
          
          if (quantity > 0) {
            position = {
              type: 'LONG',
              entryPrice: currentData.price,
              quantity,
              entryDate: currentData.date
            };
            
            console.log(`📈 Вход в LONG: ${quantity} ${config.symbol} по ${currentData.price}`);
          }
        }
      } else {
        // Логика выхода
        const currentPnLPercent = (currentData.price - position.entryPrice) / position.entryPrice * 100;
        
        // Стоп-лосс или тейк-профит
        if (currentPnLPercent <= -config.stopLossPercent || currentPnLPercent >= config.takeProfitPercent) {
          const trade: Trade = {
            id: `trade_${trades.length + 1}`,
            symbol: config.symbol,
            type: position.type === 'LONG' ? 'BUY' : 'SELL',
            entryPrice: position.entryPrice,
            exitPrice: currentData.price,
            quantity: position.quantity,
            entryDate: position.entryDate,
            exitDate: currentData.date,
            pnl: (currentData.price - position.entryPrice) * position.quantity,
            pnlPercent: currentPnLPercent,
            duration: (currentData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
          };
          
          trades.push(trade);
          capital += trade.pnl;
          position = null;
          
          console.log(`📉 Выход из позиции: PnL ${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
        }
        
        // Сигнал выхода по RSI перекупленности
        if (position && position.type === 'LONG' && rsi > config.rsiOverbought) {
          const trade: Trade = {
            id: `trade_${trades.length + 1}`,
            symbol: config.symbol,
            type: 'BUY',
            entryPrice: position.entryPrice,
            exitPrice: currentData.price,
            quantity: position.quantity,
            entryDate: position.entryDate,
            exitDate: currentData.date,
            pnl: (currentData.price - position.entryPrice) * position.quantity,
            pnlPercent: (currentData.price - position.entryPrice) / position.entryPrice * 100,
            duration: (currentData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
          };
          
          trades.push(trade);
          capital += trade.pnl;
          position = null;
          
          console.log(`📊 Выход по RSI: PnL ${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
        }
      }
      
      // Обновление кривой капитала
      const currentEquity = position 
        ? capital + (currentData.price - position.entryPrice) * position.quantity
        : capital;
      
      equityCurve.push({
        date: currentData.date,
        equity: currentEquity
      });
    }
    
    // Закрываем открытую позицию если есть
    if (position && historicalData.length > 0) {
      const lastData = historicalData[historicalData.length - 1]!;
      const trade: Trade = {
        id: `trade_${trades.length + 1}`,
        symbol: config.symbol,
        type: position.type === 'LONG' ? 'BUY' : 'SELL',
        entryPrice: position.entryPrice,
        exitPrice: lastData.price,
        quantity: position.quantity,
        entryDate: position.entryDate,
        exitDate: lastData.date,
        pnl: (lastData.price - position.entryPrice) * position.quantity,
        pnlPercent: (lastData.price - position.entryPrice) / position.entryPrice * 100,
        duration: (lastData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
      };
      
      trades.push(trade);
      capital += trade.pnl;
    }
    
    return this.calculateBacktestResult(trades, equityCurve, config);
  }

  private async executeMABacktest(historicalData: any[], config: StrategyConfig): Promise<BacktestResult> {
    const trades: Trade[] = [];
    let capital = config.initialCapital;
    let position: { type: 'LONG' | 'SHORT'; entryPrice: number; quantity: number; entryDate: Date } | null = null;
    
    const equityCurve: Array<{ date: Date; equity: number }> = [];
    
    for (let i = config.movingAveragePeriod; i < historicalData.length; i++) {
      const currentData = historicalData[i]!;
      
      // Расчет скользящей средней
      const ma = this.calculateMovingAverage(historicalData.slice(i - config.movingAveragePeriod, i + 1));
      
      if (!position) {
        // Сигнал на покупку: цена выше MA
        if (currentData.price > ma) {
          const riskAmount = capital * config.riskPerTrade;
          const quantity = Math.floor(riskAmount / currentData.price);
          
          if (quantity > 0) {
            position = {
              type: 'LONG',
              entryPrice: currentData.price,
              quantity,
              entryDate: currentData.date
            };
          }
        }
      } else {
        const currentPnLPercent = (currentData.price - position.entryPrice) / position.entryPrice * 100;
        
        // Стоп-лосс или тейк-профит
        if (currentPnLPercent <= -config.stopLossPercent || currentPnLPercent >= config.takeProfitPercent) {
          const trade: Trade = {
            id: `trade_${trades.length + 1}`,
            symbol: config.symbol,
            type: 'BUY',
            entryPrice: position.entryPrice,
            exitPrice: currentData.price,
            quantity: position.quantity,
            entryDate: position.entryDate,
            exitDate: currentData.date,
            pnl: (currentData.price - position.entryPrice) * position.quantity,
            pnlPercent: currentPnLPercent,
            duration: (currentData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
          };
          
          trades.push(trade);
          capital += trade.pnl;
          position = null;
        }
        
        // Сигнал выхода: цена ниже MA
        if (position && currentData.price < ma) {
          const trade: Trade = {
            id: `trade_${trades.length + 1}`,
            symbol: config.symbol,
            type: 'BUY',
            entryPrice: position.entryPrice,
            exitPrice: currentData.price,
            quantity: position.quantity,
            entryDate: position.entryDate,
            exitDate: currentData.date,
            pnl: (currentData.price - position.entryPrice) * position.quantity,
            pnlPercent: (currentData.price - position.entryPrice) / position.entryPrice * 100,
            duration: (currentData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
          };
          
          trades.push(trade);
          capital += trade.pnl;
          position = null;
        }
      }
      
      const currentEquity = position 
        ? capital + (currentData.price - position.entryPrice) * position.quantity
        : capital;
      
      equityCurve.push({
        date: currentData.date,
        equity: currentEquity
      });
    }
    
    return this.calculateBacktestResult(trades, equityCurve, config);
  }

  private async backtestMACDStrategy(config: StrategyConfig): Promise<BacktestResult> {
    // Заглушка для MACD стратегии
    return this.backtestRSIStrategy(config); // Временно используем RSI как заглушку
  }

  // Вспомогательные методы

  private calculateBacktestResult(
    trades: Trade[], 
    equityCurve: Array<{ date: Date; equity: number }>,
    config: StrategyConfig
  ): BacktestResult {
    
    const totalReturn = ((equityCurve[equityCurve.length - 1]?.equity || config.initialCapital) - config.initialCapital) / config.initialCapital * 100;
    const profitableTrades = trades.filter(t => t.pnl > 0).length;
    const winRate = trades.length > 0 ? profitableTrades / trades.length * 100 : 0;
    
    // Расчет максимальной просадки
    let maxDrawdown = 0;
    let peak = config.initialCapital;
    
    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const drawdown = (peak - point.equity) / peak * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    // Расчет коэффициента Шарпа (упрощенный)
    const returns = equityCurve.slice(1).map((point, i) => 
      (point.equity - equityCurve[i]!.equity) / equityCurve[i]!.equity
    );
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility * Math.sqrt(252) : 0;
    
    // Годовая доходность
    const days = (equityCurve[equityCurve.length - 1]?.date.getTime()! - equityCurve[0]?.date.getTime()!) / (1000 * 60 * 60 * 24);
    const annualizedReturn = days > 0 ? Math.pow(1 + totalReturn / 100, 365 / days) - 1 : 0;
    
    return {
      strategy: config.name,
      symbol: config.symbol,
      timeframe: config.timeframe,
      totalReturn,
      annualizedReturn: annualizedReturn * 100,
      maxDrawdown,
      sharpeRatio,
      winRate,
      totalTrades: trades.length,
      profitableTrades,
      startDate: equityCurve[0]?.date || new Date(),
      endDate: equityCurve[equityCurve.length - 1]?.date || new Date(),
      trades,
      equityCurve
    };
  }

  private calculateRSI(prices: any[]): number {
    if (prices.length < 15) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < 15; i++) {
      const change = prices[i]!.price - prices[i - 1]!.price;
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMovingAverage(prices: any[]): number {
    return prices.reduce((sum, data) => sum + data.price, 0) / prices.length;
  }

  private async generateHistoricalData(symbol: string, timeframe: string): Promise<any[]> {
    // Генерация мок-данных для демонстрации
    const data = [];
    const basePrice = this.getBasePrice(symbol);
    let price = basePrice;
    
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 год назад
    
    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      
      // Генерация реалистичного движения цены
      const volatility = 0.02; // 2% дневная волатильность
      const change = (Math.random() - 0.5) * 2 * volatility;
      price = price * (1 + change);
      
      data.push({
        date,
        price,
        volume: Math.random() * 1000000 + 50000,
        high: price * (1 + Math.random() * 0.01),
        low: price * (1 - Math.random() * 0.01),
        open: price * (1 + (Math.random() - 0.5) * 0.005)
      });
    }
    
    return data;
  }

  private getBasePrice(symbol: string): number {
    const prices: { [key: string]: number } = {
      'SBER': 280.50,
      'GAZP': 162.30,
      'LKOH': 7480.25,
      'VTBR': 0.0248,
      'ROSN': 548.75,
      'BTCUSDT': 35420.50,
      'ETHUSDT': 1985.30
    };
    
    return prices[symbol] || 100;
  }
}
   