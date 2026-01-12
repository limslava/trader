import { PriceData, TechnicalIndicators, AnalysisResult } from '../types/market';
import { MarketDataService } from './MarketDataService';

// Временные типы для совместимости
enum Recommendation {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  HOLD = 'HOLD',
  SELL = 'SELL',
  STRONG_SELL = 'STRONG_SELL'
}

enum RiskLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH'
}

enum Signal {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  NEUTRAL = 'NEUTRAL',
  SELL = 'SELL',
  STRONG_SELL = 'STRONG_SELL'
}

enum Rating {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  AVERAGE = 'AVERAGE',
  POOR = 'POOR',
  VERY_POOR = 'VERY_POOR'
}

enum RiskFactorType {
  VOLATILITY = 'VOLATILITY',
  LIQUIDITY = 'LIQUIDITY',
  LEVERAGE = 'LEVERAGE',
  MARKET = 'MARKET'
}

interface TechnicalAnalysis {
  score: number;
  indicators: any;
  trend: string;
  momentum: string;
}

interface FundamentalAnalysis {
  score: number;
  metrics: any;
  sectorComparison: number;
}

interface SentimentAnalysis {
  score: number;
  newsSentiment: number;
  socialSentiment: number;
  marketSentiment: number;
  recentNews: any[];
}

interface PriceTargets {
  stopLoss: number;
  takeProfit: number;
  target1: number;
  target2: number;
  target3: number;
}

interface RiskAssessment {
  level: RiskLevel;
  score: number;
  factors: any[];
  maxPositionSize: number;
}

export class AnalysisService {
  private marketDataService: MarketDataService;

  constructor() {
    this.marketDataService = new MarketDataService();
  }

  async analyzeAsset(symbol: string): Promise<AnalysisResult | null> {
    try {
      // Получаем данные для анализа
      const priceData = await this.marketDataService.getPrice(symbol);
      const technicalIndicators = await this.marketDataService.getTechnicalIndicators(symbol);

      if (!priceData) {
        throw new Error(`Не удалось получить данные для ${symbol}`);
      }

      // Выполняем анализ по всем компонентам
      const technicalAnalysis = await this.performTechnicalAnalysis(technicalIndicators, priceData);
      const fundamentalAnalysis = await this.performFundamentalAnalysis(symbol);
      const sentimentAnalysis = await this.performSentimentAnalysis(symbol);

      // Рассчитываем общую оценку
      const weightedScore = this.calculateWeightedScore(
        technicalAnalysis.score,
        fundamentalAnalysis.score,
        sentimentAnalysis.score
      );

      // Генерируем рекомендацию
      const recommendation = this.generateRecommendation(weightedScore);
      const confidence = this.calculateConfidence(technicalAnalysis, fundamentalAnalysis, sentimentAnalysis);

      // Рассчитываем ценовые цели
      const priceTargets = this.calculatePriceTargets(priceData, technicalIndicators, recommendation);

      // Оцениваем риски
      const riskAssessment = this.assessRisk(symbol, priceData, technicalIndicators);

      // Формируем объяснение
      const explanation = this.generateExplanation(
        symbol,
        recommendation,
        technicalAnalysis,
        fundamentalAnalysis,
        sentimentAnalysis
      );

      return {
        symbol,
        recommendation: recommendation as 'BUY' | 'SELL' | 'HOLD',
        confidence,
        reasoning: explanation,
        technicalScore: technicalAnalysis.score,
        fundamentalScore: fundamentalAnalysis.score,
        sentimentScore: sentimentAnalysis.score,
        priceTarget: priceTargets.target1,
        stopLoss: priceTargets.stopLoss,
        takeProfit: priceTargets.takeProfit,
        riskLevel: this.mapRiskLevelToSimple(riskAssessment.level),
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`Ошибка анализа актива ${symbol}:`, error);
      return null;
    }
  }

  private async performTechnicalAnalysis(
    indicators: TechnicalIndicators | null,
    priceData: PriceData
  ): Promise<TechnicalAnalysis> {
    let score = 50; // Базовая оценка

    if (indicators) {
      // Анализ RSI
      if (indicators.rsi) {
        if (indicators.rsi < 30) score += 20; // Перепроданность - бычий сигнал
        else if (indicators.rsi > 70) score -= 20; // Перекупленность - медвежий сигнал
        else if (indicators.rsi > 40 && indicators.rsi < 60) score += 10; // Нейтральная зона
      }

      // Анализ MACD
      if (indicators.macd) {
        if (indicators.macd.macd > indicators.macd.signal) score += 15;
        else score -= 10;
      }

      // Анализ скользящих средних
      if (indicators.movingAverages) {
        const { sma20, sma50, sma200 } = indicators.movingAverages;
        if (sma20 > sma50 && sma50 > sma200) score += 20; // Восходящий тренд
        else if (sma20 < sma50 && sma50 < sma200) score -= 15; // Нисходящий тренд
      }
    }

    // Нормализуем оценку
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      indicators: {
        rsi: { value: indicators?.rsi || 50, signal: this.getRSISignal(indicators?.rsi), weight: 0.3 },
        macd: { value: indicators?.macd?.macd || 0, signal: this.getMACDSignal(indicators?.macd), weight: 0.25 },
        movingAverages: { value: this.getMAScore(indicators?.movingAverages), signal: this.getMASignal(indicators?.movingAverages), weight: 0.25 },
        supportResistance: { value: this.getSupportResistanceScore(priceData, indicators), signal: Signal.NEUTRAL, weight: 0.1 },
        volume: { value: this.getVolumeScore(priceData), signal: Signal.NEUTRAL, weight: 0.1 }
      },
      trend: this.determineTrend(indicators),
      momentum: this.determineMomentum(indicators)
    };
  }

  private async performFundamentalAnalysis(symbol: string): Promise<FundamentalAnalysis> {
    // В реальном приложении здесь будет анализ финансовых показателей
    // Пока используем мок-данные
    const baseScore = 60 + (Math.random() - 0.5) * 20;

    return {
      score: Math.max(0, Math.min(100, baseScore)),
      metrics: {
        peRatio: { value: 15 + (Math.random() - 0.5) * 10, rating: this.getPERating(15), weight: 0.3 },
        dividendYield: { value: 5 + (Math.random() - 0.5) * 4, rating: this.getDividendRating(5), weight: 0.2 },
        marketCap: { value: 1000000000 + Math.random() * 9000000000, rating: Rating.GOOD, weight: 0.2 },
        revenueGrowth: { value: 10 + (Math.random() - 0.5) * 15, rating: Rating.GOOD, weight: 0.15 },
        profitMargin: { value: 15 + (Math.random() - 0.5) * 10, rating: Rating.GOOD, weight: 0.15 }
      },
      sectorComparison: 50 + (Math.random() - 0.5) * 30
    };
  }

  private async performSentimentAnalysis(symbol: string): Promise<SentimentAnalysis> {
    // Мок-данные для сентимент-анализа
    const newsSentiment = (Math.random() - 0.5) * 100;
    const socialSentiment = (Math.random() - 0.5) * 80;
    const marketSentiment = (Math.random() - 0.5) * 60;

    const score = (newsSentiment + socialSentiment + marketSentiment) / 3 + 50;

    return {
      score: Math.max(0, Math.min(100, score)),
      newsSentiment,
      socialSentiment,
      marketSentiment,
      recentNews: [
        {
          title: 'Компания показывает стабильный рост',
          source: 'RBC',
          publishedAt: new Date(Date.now() - 3600000),
          sentiment: 70
        },
        {
          title: 'Аналитики повышают целевые цены',
          source: 'Коммерсант',
          publishedAt: new Date(Date.now() - 7200000),
          sentiment: 80
        }
      ]
    };
  }

  private calculateWeightedScore(technical: number, fundamental: number, sentiment: number): number {
    // Веса: технический анализ 40%, фундаментальный 30%, сентимент 30%
    return technical * 0.4 + fundamental * 0.3 + sentiment * 0.3;
  }

  private generateRecommendation(weightedScore: number): Recommendation {
    if (weightedScore >= 80) return Recommendation.STRONG_BUY;
    if (weightedScore >= 65) return Recommendation.BUY;
    if (weightedScore >= 45) return Recommendation.HOLD;
    if (weightedScore >= 30) return Recommendation.SELL;
    return Recommendation.STRONG_SELL;
  }

  private calculateConfidence(technical: TechnicalAnalysis, fundamental: FundamentalAnalysis, sentiment: SentimentAnalysis): number {
    // Уверенность основана на согласованности сигналов
    const technicalConfidence = Math.abs(technical.score - 50) / 50 * 100;
    const fundamentalConfidence = Math.abs(fundamental.score - 50) / 50 * 100;
    const sentimentConfidence = Math.abs(sentiment.score - 50) / 50 * 100;

    return (technicalConfidence * 0.4 + fundamentalConfidence * 0.3 + sentimentConfidence * 0.3);
  }

  // Вспомогательные методы для технического анализа...
  private getRSISignal(rsi?: number): any {
    if (!rsi) return 'NEUTRAL';
    if (rsi < 30) return 'STRONG_BUY';
    if (rsi < 40) return 'BUY';
    if (rsi > 70) return 'STRONG_SELL';
    if (rsi > 60) return 'SELL';
    return 'NEUTRAL';
  }

  private getMACDSignal(macd?: any): any {
    if (!macd) return 'NEUTRAL';
    return macd.macd > macd.signal ? 'BUY' : 'SELL';
  }

  private getMAScore(ma?: any): number {
    if (!ma) return 50;
    return (ma.sma20 > ma.sma50 && ma.sma50 > ma.sma200) ? 80 : 40;
  }

  private getMASignal(ma?: any): any {
    if (!ma) return 'NEUTRAL';
    return (ma.sma20 > ma.sma50 && ma.sma50 > ma.sma200) ? 'BUY' : 'SELL';
  }

  private getSupportResistanceScore(priceData: PriceData, indicators: TechnicalIndicators | null): number {
    // Упрощенная логика поддержки/сопротивления
    return 50;
  }

  private getVolumeScore(priceData: PriceData): number {
    // Анализ объема
    return priceData.volume > 500000 ? 70 : 50;
  }

  private determineTrend(indicators: TechnicalIndicators | null): any {
    if (!indicators?.movingAverages) return 'SIDEWAYS';
    const { sma20, sma50, sma200 } = indicators.movingAverages;
    
    if (sma20 > sma50 && sma50 > sma200) return 'STRONG_UP';
    if (sma20 > sma50) return 'UP';
    if (sma20 < sma50 && sma50 < sma200) return 'STRONG_DOWN';
    if (sma20 < sma50) return 'DOWN';
    return 'SIDEWAYS';
  }

  private determineMomentum(indicators: TechnicalIndicators | null): any {
    if (!indicators?.macd) return 'NEUTRAL';
    return indicators.macd.macd > indicators.macd.signal ? 'BULLISH' : 'BEARISH';
  }

  private getPERating(pe: number): any {
    if (pe < 10) return 'EXCELLENT';
    if (pe < 15) return 'GOOD';
    if (pe < 20) return 'AVERAGE';
    if (pe < 25) return 'POOR';
    return 'VERY_POOR';
  }

  private getDividendRating(dividend: number): any {
    if (dividend > 8) return 'EXCELLENT';
    if (dividend > 6) return 'GOOD';
    if (dividend > 4) return 'AVERAGE';
    if (dividend > 2) return 'POOR';
    return 'VERY_POOR';
  }

  private calculatePriceTargets(priceData: PriceData, indicators: TechnicalIndicators | null, recommendation: Recommendation): PriceTargets {
    const currentPrice = priceData.price;
    let stopLoss, takeProfit, target1, target2, target3;

    switch (recommendation) {
      case Recommendation.STRONG_BUY:
      case Recommendation.BUY:
        stopLoss = currentPrice * 0.95;
        takeProfit = currentPrice * 1.1;
        target1 = currentPrice * 1.05;
        target2 = currentPrice * 1.08;
        target3 = currentPrice * 1.12;
        break;
      case Recommendation.SELL:
      case Recommendation.STRONG_SELL:
        stopLoss = currentPrice * 1.05;
        takeProfit = currentPrice * 0.9;
        target1 = currentPrice * 0.95;
        target2 = currentPrice * 0.92;
        target3 = currentPrice * 0.88;
        break;
      default:
        stopLoss = currentPrice * 0.98;
        takeProfit = currentPrice * 1.02;
        target1 = currentPrice;
        target2 = currentPrice;
        target3 = currentPrice;
    }

    return {
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      target1: Math.round(target1 * 100) / 100,
      target2: Math.round(target2 * 100) / 100,
      target3: Math.round(target3 * 100) / 100
    };
  }

  private assessRisk(symbol: string, priceData: PriceData, indicators: TechnicalIndicators | null): RiskAssessment {
    const volatility = Math.abs(priceData.changePercent);
    let riskScore = 30; // Начинаем с более низкой базовой оценки

    // Учитываем волатильность (основной фактор)
    if (volatility > 8) riskScore += 40; // Очень высокая волатильность
    else if (volatility > 5) riskScore += 30; // Высокая волатильность
    else if (volatility > 3) riskScore += 20; // Средняя волатильность
    else if (volatility > 1) riskScore += 10; // Низкая волатильность

    // Учитываем объем (низкий объем = выше риск)
    if (priceData.volume < 50000) riskScore += 25; // Очень низкая ликвидность
    else if (priceData.volume < 200000) riskScore += 15; // Низкая ликвидность
    else if (priceData.volume < 500000) riskScore += 5; // Средняя ликвидность

    // Учитываем тип актива (крипто vs акции)
    const isCrypto = symbol.includes('USDT');
    if (isCrypto) riskScore += 15; // Криптовалюты обычно более волатильны

    // Учитываем технические индикаторы
    if (indicators?.rsi) {
      if (indicators.rsi < 20 || indicators.rsi > 80) riskScore += 10; // Экстремальные значения RSI
    }

    // Нормализуем оценку
    riskScore = Math.max(10, Math.min(100, riskScore));

    let riskLevel: RiskLevel;
    if (riskScore >= 75) riskLevel = RiskLevel.VERY_HIGH;
    else if (riskScore >= 60) riskLevel = RiskLevel.HIGH;
    else if (riskScore >= 40) riskLevel = RiskLevel.MEDIUM;
    else if (riskScore >= 25) riskLevel = RiskLevel.LOW;
    else riskLevel = RiskLevel.VERY_LOW;

    return {
      level: riskLevel,
      score: riskScore,
      factors: [
        { type: RiskFactorType.VOLATILITY, description: `Волатильность: ${volatility.toFixed(2)}%`, impact: Math.min(volatility * 8, 100) },
        { type: RiskFactorType.LIQUIDITY, description: `Объем: ${priceData.volume.toLocaleString()}`, impact: priceData.volume < 100000 ? 70 : 30 },
        { type: RiskFactorType.MARKET, description: `Тип: ${isCrypto ? 'Криптовалюта' : 'Акция'}`, impact: isCrypto ? 60 : 20 }
      ],
      maxPositionSize: Math.max(1, 5 - (riskScore - 30) / 15) // 1-5% в зависимости от риска
    };
  }

  private mapRiskLevelToSimple(riskLevel: RiskLevel): 'LOW' | 'MEDIUM' | 'HIGH' {
    switch (riskLevel) {
      case RiskLevel.VERY_LOW:
      case RiskLevel.LOW:
        return 'LOW';
      case RiskLevel.MEDIUM:
        return 'MEDIUM';
      case RiskLevel.HIGH:
      case RiskLevel.VERY_HIGH:
        return 'HIGH';
      default:
        return 'MEDIUM';
    }
  }

  private generateExplanation(
    symbol: string,
    recommendation: Recommendation,
    technical: TechnicalAnalysis,
    fundamental: FundamentalAnalysis,
    sentiment: SentimentAnalysis
  ): string {
    const reasons = [];

    if (technical.score > 60) reasons.push('технические индикаторы показывают позитивную динамику');
    else if (technical.score < 40) reasons.push('технические индикаторы демонстрируют слабость');

    if (fundamental.score > 60) reasons.push('фундаментальные показатели выглядят привлекательно');
    else if (fundamental.score < 40) reasons.push('фундаментальные показатели вызывают опасения');

    if (sentiment.score > 60) reasons.push('рыночные настроения позитивные');
    else if (sentiment.score < 40) reasons.push('рыночные настроения негативные');

    const reasonText = reasons.length > 0 ? reasons.join(', ') : 'рынок находится в нейтральной зоне';

    return `Для актива ${symbol} рекомендуется ${this.getRecommendationText(recommendation)}. ${reasonText.charAt(0).toUpperCase() + reasonText.slice(1)}.`;
  }

  private getRecommendationText(recommendation: Recommendation): string {
    switch (recommendation) {
      case Recommendation.STRONG_BUY: return 'сильная покупка';
      case Recommendation.BUY: return 'покупка';
      case Recommendation.HOLD: return 'удержание';
      case Recommendation.SELL: return 'продажа';
      case Recommendation.STRONG_SELL: return 'сильная продажа';
      default: return 'нейтральная позиция';
    }
  }
}