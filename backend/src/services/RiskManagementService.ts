import { PortfolioService, PortfolioSummary, PortfolioPosition } from './PortfolioService';
import { MarketDataService } from './MarketDataService';

export interface RiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high';
  portfolioRiskScore: number;
  diversificationScore: number;
  concentrationRisk: number;
  volatilityRisk: number;
  recommendations: RiskRecommendation[];
  warnings: RiskWarning[];
}

export interface RiskRecommendation {
  type: 'diversification' | 'stop_loss' | 'position_size' | 'asset_allocation';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  affectedAssets?: string[];
}

export interface RiskWarning {
  type: 'high_volatility' | 'concentration' | 'stop_loss_breach' | 'position_size';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  affectedAsset?: string;
  currentValue?: number;
  threshold?: number;
}

export interface StopLossRecommendation {
  assetSymbol: string;
  currentPrice: number;
  recommendedStopLoss: number;
  stopLossPercentage: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export class RiskManagementService {
  private portfolioService: PortfolioService;
  private marketDataService: MarketDataService;

  constructor() {
    this.portfolioService = new PortfolioService();
    this.marketDataService = new MarketDataService();
  }

  /**
   * Полная оценка рисков портфеля
   */
  async assessPortfolioRisk(userId: string): Promise<RiskAssessment> {
    try {
      const portfolio = await this.portfolioService.getPortfolio(userId);
      const recommendations: RiskRecommendation[] = [];
      const warnings: RiskWarning[] = [];

      // Анализ диверсификации
      const diversificationScore = this.calculateDiversificationScore(portfolio);
      if (diversificationScore < 0.6) {
        recommendations.push(this.createDiversificationRecommendation(portfolio));
      }

      // Анализ концентрации
      const concentrationRisk = this.calculateConcentrationRisk(portfolio);
      if (concentrationRisk > 0.3) {
        warnings.push(this.createConcentrationWarning(portfolio, concentrationRisk));
      }

      // Проверка стоп-лоссов
      const stopLossWarnings = await this.checkStopLosses(portfolio, userId);
      warnings.push(...stopLossWarnings);

      // Проверка размера позиций
      const positionSizeWarnings = this.checkPositionSizes(portfolio);
      warnings.push(...positionSizeWarnings);

      // Расчет общего уровня риска
      const overallRiskLevel = this.calculateOverallRiskLevel(
        diversificationScore,
        concentrationRisk,
        warnings
      );

      return {
        overallRiskLevel,
        portfolioRiskScore: this.calculateRiskScore(portfolio, warnings),
        diversificationScore,
        concentrationRisk,
        volatilityRisk: this.calculateVolatilityRisk(portfolio),
        recommendations,
        warnings
      };
    } catch (error) {
      console.error('Ошибка оценки рисков портфеля:', error);
      throw new Error('Не удалось оценить риски портфеля');
    }
  }

  /**
   * Рекомендации по стоп-лоссам для активов
   */
  async getStopLossRecommendations(userId: string): Promise<StopLossRecommendation[]> {
    try {
      const portfolio = await this.portfolioService.getPortfolio(userId);
      const recommendations: StopLossRecommendation[] = [];

      for (const position of portfolio.positions) {
        const stopLossPercentage = this.calculateStopLossPercentage(position);
        const recommendedStopLoss = position.currentPrice * (1 - stopLossPercentage / 100);
        
        recommendations.push({
          assetSymbol: position.assetSymbol,
          currentPrice: position.currentPrice,
          recommendedStopLoss,
          stopLossPercentage,
          riskLevel: this.getAssetRiskLevel(position)
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Ошибка расчета стоп-лоссов:', error);
      throw new Error('Не удалось рассчитать стоп-лоссы');
    }
  }

  /**
   * Расчет максимального размера позиции для новичка
   */
  calculateMaxPositionSize(totalPortfolioValue: number, riskTolerance: 'low' | 'medium' | 'high' = 'low'): number {
    const riskMultipliers = {
      low: 0.02,    // 2% для консервативных
      medium: 0.05, // 5% для умеренных
      high: 0.1     // 10% для агрессивных
    };

    return totalPortfolioValue * riskMultipliers[riskTolerance];
  }

  /**
   * Расчет стоп-лосса на основе волатильности
   */
  private calculateStopLossPercentage(position: PortfolioPosition): number {
    // Базовые стоп-лоссы для новичков
    const baseStopLosses = {
      stock: 10,    // 10% для акций
      crypto: 15,   // 15% для криптовалют
      currency: 5   // 5% для валют
    };

    // Корректировка на основе прибыли/убытков
    let adjustment = 0;
    if (position.profitLossPercentage > 20) {
      adjustment = -2; // Уже в прибыли - можно уменьшить стоп-лосс
    } else if (position.profitLossPercentage < -10) {
      adjustment = 2;  // В убытках - увеличить стоп-лосс
    }

    return baseStopLosses[position.assetType] + adjustment;
  }

  /**
   * Оценка уровня риска актива
   */
  private getAssetRiskLevel(position: PortfolioPosition): 'low' | 'medium' | 'high' {
    const riskFactors: Record<string, 'low' | 'medium' | 'high'> = {
      stock: position.assetSymbol.includes('SBER') || position.assetSymbol.includes('GAZP') ? 'low' : 'medium',
      crypto: 'high',
      currency: 'low'
    };

    return riskFactors[position.assetType] || 'medium';
  }

  /**
   * Расчет оценки диверсификации
   */
  private calculateDiversificationScore(portfolio: PortfolioSummary): number {
    if (portfolio.positions.length === 0) return 0;

    // Идеальная диверсификация: 5-7 активов разных типов
    const positionCountScore = Math.min(portfolio.positions.length / 7, 1);
    
    // Разнообразие типов активов
    const assetTypes = new Set(portfolio.positions.map(p => p.assetType));
    const typeDiversityScore = assetTypes.size / 2; // Максимум 2 типа (акции/крипто)

    return (positionCountScore * 0.6 + typeDiversityScore * 0.4);
  }

  /**
   * Расчет риска концентрации
   */
  private calculateConcentrationRisk(portfolio: PortfolioSummary): number {
    if (portfolio.positions.length === 0) return 0;

    // Наибольшая позиция в портфеле
    const maxPosition = Math.max(...portfolio.positions.map(p => p.currentValue / portfolio.totalValue));
    return maxPosition;
  }

  /**
   * Расчет риска волатильности
   */
  private calculateVolatilityRisk(portfolio: PortfolioSummary): number {
    let volatilityScore = 0;
    let totalWeight = 0;

    for (const position of portfolio.positions) {
      const weight = position.currentValue / portfolio.totalValue;
      const assetVolatility = position.assetType === 'crypto' ? 0.8 : 0.4;
      volatilityScore += weight * assetVolatility;
      totalWeight += weight;
    }

    return totalWeight > 0 ? volatilityScore / totalWeight : 0;
  }

  /**
   * Проверка стоп-лоссов
   */
  private async checkStopLosses(portfolio: PortfolioSummary, userId: string): Promise<RiskWarning[]> {
    const warnings: RiskWarning[] = [];
    const recommendations = await this.getStopLossRecommendations(userId);

    for (const position of portfolio.positions) {
      const recommendation = recommendations.find(r => r.assetSymbol === position.assetSymbol);
      if (recommendation) {
        const currentDrawdown = (position.currentPrice - position.averagePrice) / position.averagePrice * 100;
        
        if (currentDrawdown < -recommendation.stopLossPercentage * 0.8) {
          warnings.push({
            type: 'stop_loss_breach',
            severity: 'critical',
            title: 'Приближение к стоп-лоссу',
            description: `${position.assetSymbol} приближается к рекомендуемому стоп-лоссу`,
            affectedAsset: position.assetSymbol,
            currentValue: position.currentPrice,
            threshold: recommendation.recommendedStopLoss
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Проверка размера позиций
   */
  private checkPositionSizes(portfolio: PortfolioSummary): RiskWarning[] {
    const warnings: RiskWarning[] = [];
    const maxPositionSize = this.calculateMaxPositionSize(portfolio.totalValue, 'low');

    for (const position of portfolio.positions) {
      if (position.currentValue > maxPositionSize) {
        warnings.push({
          type: 'position_size',
          severity: 'warning',
          title: 'Слишком большая позиция',
          description: `${position.assetSymbol} превышает рекомендуемый размер позиции`,
          affectedAsset: position.assetSymbol,
          currentValue: position.currentValue,
          threshold: maxPositionSize
        });
      }
    }

    return warnings;
  }

  /**
   * Расчет общего уровня риска
   */
  private calculateOverallRiskLevel(
    diversificationScore: number,
    concentrationRisk: number,
    warnings: RiskWarning[]
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Диверсификация (чем выше - тем лучше)
    riskScore += (1 - diversificationScore) * 40;

    // Концентрация (чем выше - тем хуже)
    riskScore += concentrationRisk * 40;

    // Критические предупреждения
    const criticalWarnings = warnings.filter(w => w.severity === 'critical').length;
    riskScore += criticalWarnings * 20;

    if (riskScore < 30) return 'low';
    if (riskScore < 60) return 'medium';
    return 'high';
  }

  /**
   * Расчет общего скора риска
   */
  private calculateRiskScore(portfolio: PortfolioSummary, warnings: RiskWarning[]): number {
    const diversificationScore = this.calculateDiversificationScore(portfolio);
    const concentrationRisk = this.calculateConcentrationRisk(portfolio);
    const criticalWarnings = warnings.filter(w => w.severity === 'critical').length;

    return Math.round(
      (1 - diversificationScore) * 40 +
      concentrationRisk * 40 +
      criticalWarnings * 20
    );
  }

  /**
   * Создание рекомендации по диверсификации
   */
  private createDiversificationRecommendation(portfolio: PortfolioSummary): RiskRecommendation {
    return {
      type: 'diversification',
      priority: portfolio.positions.length < 3 ? 'high' : 'medium',
      title: 'Увеличить диверсификацию портфеля',
      description: `В вашем портфеле ${portfolio.positions.length} активов. Рекомендуется иметь 5-7 активов для снижения рисков.`,
      action: 'Добавить новые активы в портфель',
      affectedAssets: portfolio.positions.map(p => p.assetSymbol)
    };
  }

  /**
   * Создание предупреждения о концентрации
   */
  private createConcentrationWarning(portfolio: PortfolioSummary, concentrationRisk: number): RiskWarning {
    const largestPosition = portfolio.positions.reduce((max, p) => 
      p.currentValue > max.currentValue ? p : max
    );

    return {
      type: 'concentration',
      severity: concentrationRisk > 0.5 ? 'critical' : 'warning',
      title: 'Высокая концентрация риска',
      description: `${largestPosition.assetSymbol} составляет ${Math.round(concentrationRisk * 100)}% портфеля`,
      affectedAsset: largestPosition.assetSymbol,
      currentValue: concentrationRisk,
      threshold: 0.3
    };
  }
}