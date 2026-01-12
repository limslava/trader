import { memoryCacheService } from './MemoryCacheService';

export interface MLPrediction {
  symbol: string;
  prediction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  predictedPrice: number;
  predictedChange: number;
  timeframe: '1h' | '4h' | '1d' | '1w';
  reasoning: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: Date;
}

export interface TechnicalPattern {
  name: string;
  strength: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timeframe: string;
  probability: number;
}

export interface SentimentAnalysis {
  overall: number; // -1 to 1 (negative to positive)
  news: number;
  social: number;
  technical: number;
  volume: number;
}

export class MLPredictionService {
  private cacheTtl: number = 300; // 5 минут для прогнозов

  /**
   * Получить ML-прогноз для актива
   */
  async getPrediction(symbol: string, timeframe: '1h' | '4h' | '1d' | '1w' = '1d'): Promise<MLPrediction | null> {
    const cacheKey = `ml_prediction:${symbol}:${timeframe}`;
    
    // Попробовать получить из кэша
    const cached = await memoryCacheService.get<MLPrediction>(cacheKey);
    if (cached) {
      console.log(`🤖 ML прогноз ${symbol} (${timeframe}) получен из кэша`);
      return cached;
    }

    // Генерация ML прогноза
    const prediction = await this.generateMLPrediction(symbol, timeframe);
    if (!prediction) {
      return null;
    }

    // Сохранить в кэш
    await memoryCacheService.set(cacheKey, prediction, { ttl: this.cacheTtl });
    console.log(`🤖 ML прогноз ${symbol} (${timeframe}) сохранен в кэш`);

    return prediction;
  }

  /**
   * Получить технические паттерны для актива
   */
  async getTechnicalPatterns(symbol: string): Promise<TechnicalPattern[]> {
    const cacheKey = `technical_patterns:${symbol}`;
    
    const cached = await memoryCacheService.get<TechnicalPattern[]>(cacheKey);
    if (cached) {
      console.log(`📈 Технические паттерны ${symbol} получены из кэша`);
      return cached;
    }

    const patterns = await this.analyzeTechnicalPatterns(symbol);
    
    // Сохранить в кэш на 10 минут
    await memoryCacheService.set(cacheKey, patterns, { ttl: 600 });
    console.log(`📈 Технические паттерны ${symbol} сохранены в кэш`);

    return patterns;
  }

  /**
   * Анализ сентимента для актива
   */
  async analyzeSentiment(symbol: string): Promise<SentimentAnalysis> {
    const cacheKey = `sentiment:${symbol}`;
    
    const cached = await memoryCacheService.get<SentimentAnalysis>(cacheKey);
    if (cached) {
      console.log(`🎭 Сентимент анализ ${symbol} получен из кэша`);
      return cached;
    }

    const sentiment = await this.calculateSentiment(symbol);
    
    // Сохранить в кэш на 15 минут
    await memoryCacheService.set(cacheKey, sentiment, { ttl: 900 });
    console.log(`🎭 Сентимент анализ ${symbol} сохранен в кэш`);

    return sentiment;
  }

  /**
   * Получить рекомендации на основе ML для начинающих
   */
  async getBeginnerRecommendations(): Promise<MLPrediction[]> {
    const cacheKey = 'ml_recommendations:beginner';
    
    const cached = await memoryCacheService.get<MLPrediction[]>(cacheKey);
    if (cached) {
      console.log('🎯 ML рекомендации для начинающих получены из кэша');
      return cached;
    }

    const popularSymbols = ['SBER', 'GAZP', 'LKOH', 'BTCUSDT', 'ETHUSDT'];
    const recommendations: MLPrediction[] = [];

    for (const symbol of popularSymbols) {
      const prediction = await this.getPrediction(symbol, '1d');
      if (prediction && prediction.confidence > 60) {
        recommendations.push(prediction);
      }
    }

    // Сортировка по уверенности
    recommendations.sort((a, b) => b.confidence - a.confidence);

    // Сохранить в кэш на 10 минут
    await memoryCacheService.set(cacheKey, recommendations, { ttl: 600 });
    console.log('🎯 ML рекомендации для начинающих сохранены в кэш');

    return recommendations;
  }

  /**
   * Генерация ML прогноза (демо-версия с эмуляцией ML)
   */
  private async generateMLPrediction(symbol: string, timeframe: string): Promise<MLPrediction | null> {
    // Эмуляция ML модели для демонстрации
    // В реальном приложении здесь будет интеграция с TensorFlow, PyTorch и т.д.
    
    try {
      // Базовая цена для расчетов
      const basePrice = this.getBasePrice(symbol);
      if (!basePrice) return null;

      // Технический анализ
      const technicalScore = this.calculateTechnicalScore(symbol);
      const sentiment = await this.analyzeSentiment(symbol);
      
      // Комбинированный скоринг
      const combinedScore = (
        technicalScore * 0.6 + 
        sentiment.overall * 0.3 + 
        sentiment.volume * 0.1
      );

      // Определение рекомендации
      let prediction: 'BUY' | 'SELL' | 'HOLD';
      let confidence: number;
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';

      if (combinedScore > 0.3) {
        prediction = 'BUY';
        confidence = Math.min(95, Math.round((combinedScore + 0.3) * 100));
        riskLevel = combinedScore > 0.6 ? 'LOW' : 'MEDIUM';
      } else if (combinedScore < -0.3) {
        prediction = 'SELL';
        confidence = Math.min(95, Math.round((Math.abs(combinedScore) + 0.3) * 100));
        riskLevel = combinedScore < -0.6 ? 'LOW' : 'MEDIUM';
      } else {
        prediction = 'HOLD';
        confidence = Math.round((0.5 - Math.abs(combinedScore)) * 100);
        riskLevel = 'MEDIUM';
      }

      // Расчет прогнозируемой цены
      const volatility = this.getVolatility(symbol);
      const predictedChange = combinedScore * volatility * 0.1;
      const predictedPrice = basePrice * (1 + predictedChange);

      // Формирование обоснования
      const reasoning = this.generateReasoning(symbol, prediction, technicalScore, sentiment);

      return {
        symbol,
        prediction,
        confidence,
        predictedPrice: Number(predictedPrice.toFixed(2)),
        predictedChange: Number((predictedChange * 100).toFixed(2)),
        timeframe: timeframe as any,
        reasoning,
        riskLevel,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`Ошибка генерации ML прогноза для ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Анализ технических паттернов (демо-версия)
   */
  private async analyzeTechnicalPatterns(symbol: string): Promise<TechnicalPattern[]> {
    // Эмуляция анализа технических паттернов
    const patterns: TechnicalPattern[] = [];
    
    // Случайные паттерны для демонстрации
    const possiblePatterns = [
      { name: 'Поддержка', direction: 'BULLISH' as const },
      { name: 'Сопротивление', direction: 'BEARISH' as const },
      { name: 'Двойное дно', direction: 'BULLISH' as const },
      { name: 'Голова и плечи', direction: 'BEARISH' as const },
      { name: 'Треугольник', direction: 'NEUTRAL' as const },
      { name: 'Флаг', direction: 'BULLISH' as const },
      { name: 'Вымпел', direction: 'NEUTRAL' as const }
    ];

    // Генерация 2-4 случайных паттернов
    const numPatterns = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < numPatterns; i++) {
      const pattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];
      const selectedPattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];
      if (selectedPattern) {
        patterns.push({
          name: selectedPattern.name,
          direction: selectedPattern.direction,
          strength: Math.random() * 0.5 + 0.5, // 0.5 - 1.0
          timeframe: ['1h', '4h', '1d'][Math.floor(Math.random() * 3)] as string,
          probability: Math.random() * 0.3 + 0.7 // 0.7 - 1.0
        });
      }
    }

    return patterns;
  }

  /**
   * Расчет сентимента (демо-версия)
   */
  private async calculateSentiment(symbol: string): Promise<SentimentAnalysis> {
    // Эмуляция анализа сентимента
    const baseScore = Math.random() * 0.4 - 0.2; // -0.2 to 0.2
    
    return {
      overall: baseScore,
      news: baseScore + (Math.random() * 0.2 - 0.1),
      social: baseScore + (Math.random() * 0.3 - 0.15),
      technical: baseScore + (Math.random() * 0.4 - 0.2),
      volume: Math.random() * 0.5 + 0.5 // 0.5 - 1.0
    };
  }

  /**
   * Вспомогательные методы для демо-версии
   */
  private getBasePrice(symbol: string): number {
    const basePrices: Record<string, number> = {
      'SBER': 280,
      'GAZP': 160,
      'LKOH': 7200,
      'VTBR': 0.025,
      'ROSN': 560,
      'BTCUSDT': 35000,
      'ETHUSDT': 1800,
      'BNBUSDT': 230,
      'ADAUSDT': 0.35,
      'DOTUSDT': 4.2
    };
    return basePrices[symbol] || 100;
  }

  private calculateTechnicalScore(symbol: string): number {
    // Эмуляция технического анализа
    return Math.random() * 0.8 - 0.4; // -0.4 to 0.4
  }

  private getVolatility(symbol: string): number {
    const volatilities: Record<string, number> = {
      'SBER': 0.02,
      'GAZP': 0.015,
      'LKOH': 0.025,
      'BTCUSDT': 0.08,
      'ETHUSDT': 0.06
    };
    return volatilities[symbol] || 0.03;
  }

  private generateReasoning(
    symbol: string, 
    prediction: string, 
    technicalScore: number, 
    sentiment: SentimentAnalysis
  ): string {
    const reasons = [
      `Технический анализ показывает ${technicalScore > 0 ? 'положительную' : 'отрицательную'} динамику`,
      `Сентимент рынка ${sentiment.overall > 0 ? 'оптимистичный' : 'пессимистичный'}`,
      `Объем торгов ${sentiment.volume > 0.7 ? 'выше среднего' : 'в пределах нормы'}`,
      `Новостной фон ${sentiment.news > 0 ? 'благоприятный' : 'негативный'}`,
      `Социальные настроения ${sentiment.social > 0 ? 'позитивные' : 'осторожные'}`
    ];

    return reasons.slice(0, 3).join('. ') + '.';
  }

  /**
   * Инвалидация кэша ML прогнозов
   */
  async invalidateMLCache(symbol?: string): Promise<void> {
    if (symbol) {
      const patterns = [
        `ml_prediction:${symbol}:*`,
        `technical_patterns:${symbol}`,
        `sentiment:${symbol}`
      ];
      
      for (const pattern of patterns) {
        await memoryCacheService.clearPattern(pattern);
      }
      console.log(`🗑️ ML кэш для ${symbol} очищен`);
    } else {
      await memoryCacheService.clearPattern('ml_prediction:*');
      await memoryCacheService.clearPattern('technical_patterns:*');
      await memoryCacheService.clearPattern('sentiment:*');
      await memoryCacheService.clearPattern('ml_recommendations:*');
      console.log('🗑️ Весь ML кэш очищен');
    }
  }
}

// Глобальный экземпляр ML сервиса
export const mlPredictionService = new MLPredictionService();