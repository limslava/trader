import { MemoryCacheService } from './MemoryCacheService';

export interface AssetAllocation {
  symbol: string;
  targetWeight: number;
  currentWeight: number;
  recommendedAction: 'BUY' | 'SELL' | 'HOLD';
  quantityToTrade: number;
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
}

export interface PortfolioOptimizationResult {
  optimizedAllocation: AssetAllocation[];
  expectedPortfolioReturn: number;
  expectedPortfolioRisk: number;
  sharpeRatio: number;
  efficientFrontier: Array<{ return: number; risk: number }>;
  rebalancingNeeded: boolean;
  totalRebalancingCost: number;
}

export interface HistoricalData {
  symbol: string;
  returns: number[];
  prices: number[];
  volatility: number;
  averageReturn: number;
}

export class PortfolioOptimizationService {
  private cacheService: MemoryCacheService;

  constructor() {
    this.cacheService = new MemoryCacheService();
  }

  // Основной метод оптимизации портфеля
  async optimizePortfolio(
    currentPositions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    totalPortfolioValue: number,
    riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM',
    optimizationMethod: 'MARKOWITZ' | 'BLACK_LITTERMAN' | 'RISK_PARITY' = 'MARKOWITZ'
  ): Promise<PortfolioOptimizationResult> {
    const cacheKey = `portfolio_optimization_${riskTolerance}_${optimizationMethod}_${totalPortfolioValue}`;
    
    try {
      // Проверяем кэш
      const cached = await this.cacheService.get<PortfolioOptimizationResult>(cacheKey);
      if (cached) {
        console.log('📊 Оптимизация портфеля загружена из кэша');
        return cached;
      }

      // Получаем исторические данные для активов
      const historicalData = await this.getHistoricalDataForAssets(currentPositions.map(p => p.symbol));
      
      // Выполняем оптимизацию в зависимости от выбранного метода
      let optimizationResult: PortfolioOptimizationResult;
      
      switch (optimizationMethod) {
        case 'MARKOWITZ':
          optimizationResult = await this.markowitzOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance);
          break;
        case 'BLACK_LITTERMAN':
          optimizationResult = await this.blackLittermanOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance);
          break;
        case 'RISK_PARITY':
          optimizationResult = await this.riskParityOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance);
          break;
        default:
          optimizationResult = await this.markowitzOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance);
      }

      // Сохраняем в кэш на 1 час
      this.cacheService.set(cacheKey, optimizationResult, { ttl: 3600 });
      
      console.log(`✅ Портфель оптимизирован: ожидаемая доходность ${optimizationResult.expectedPortfolioReturn.toFixed(2)}%, риск ${optimizationResult.expectedPortfolioRisk.toFixed(2)}%`);
      return optimizationResult;

    } catch (error) {
      console.error('❌ Ошибка оптимизации портфеля:', error);
      throw new Error('Не удалось оптимизировать портфель');
    }
  }

  // Оптимизация по Марковицу (Mean-Variance Optimization)
  private async markowitzOptimization(
    currentPositions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    totalPortfolioValue: number,
    historicalData: HistoricalData[],
    riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<PortfolioOptimizationResult> {
    
    // Расчет ковариационной матрицы и ожидаемых доходностей
    const covarianceMatrix = this.calculateCovarianceMatrix(historicalData);
    const expectedReturns = historicalData.map(data => data.averageReturn);
    
    // Целевая доходность в зависимости от толерантности к риску
    const targetReturn = this.getTargetReturn(riskTolerance);
    
    // Оптимизация весов активов
    const optimizedWeights = this.solveMarkowitzOptimization(expectedReturns, covarianceMatrix, targetReturn);
    
    // Формируем результат оптимизации
    return this.buildOptimizationResult(currentPositions, totalPortfolioValue, historicalData, optimizedWeights);
  }

  // Оптимизация по Блэку-Литтерману
  private async blackLittermanOptimization(
    currentPositions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    totalPortfolioValue: number,
    historicalData: HistoricalData[],
    riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<PortfolioOptimizationResult> {
    
    // Базовые ожидаемые доходности (рыночные равновесные)
    const equilibriumReturns = historicalData.map(data => data.averageReturn);
    
    // Взгляды инвестора (views) - можно настроить на основе ML-прогнозов
    const investorViews = this.generateInvestorViews(historicalData);
    
    // Объединение рыночных ожиданий и взглядов инвестора
    const blendedReturns = this.blendEquilibriumAndViews(equilibriumReturns, investorViews, historicalData);
    
    // Оптимизация с учетом скорректированных ожиданий
    const covarianceMatrix = this.calculateCovarianceMatrix(historicalData);
    const optimizedWeights = this.solveMarkowitzOptimization(blendedReturns, covarianceMatrix, this.getTargetReturn(riskTolerance));
    
    return this.buildOptimizationResult(currentPositions, totalPortfolioValue, historicalData, optimizedWeights);
  }

  // Оптимизация по паритету риска (Risk Parity)
  private async riskParityOptimization(
    currentPositions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    totalPortfolioValue: number,
    historicalData: HistoricalData[],
    riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<PortfolioOptimizationResult> {
    
    const volatilities = historicalData.map(data => data.volatility);
    const correlationMatrix = this.calculateCorrelationMatrix(historicalData);
    
    // Расчет весов для равного вклада в риск
    const riskParityWeights = this.calculateRiskParityWeights(volatilities, correlationMatrix);
    
    return this.buildOptimizationResult(currentPositions, totalPortfolioValue, historicalData, riskParityWeights);
  }

  // Расчет ковариационной матрицы
  private calculateCovarianceMatrix(historicalData: HistoricalData[]): number[][] {
    const n = historicalData.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dataI = historicalData[i]!;
        const dataJ = historicalData[j]!;
        
        if (i === j) {
          matrix[i]![j] = Math.pow(dataI.volatility, 2);
        } else {
          // Упрощенный расчет ковариации
          const correlation = this.getAssetCorrelation(dataI.symbol, dataJ.symbol);
          matrix[i]![j] = correlation * dataI.volatility * dataJ.volatility;
        }
      }
    }
    
    return matrix;
  }

  // Расчет матрицы корреляций
  private calculateCorrelationMatrix(historicalData: HistoricalData[]): number[][] {
    const n = historicalData.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dataI = historicalData[i]!;
        const dataJ = historicalData[j]!;
        
        if (i === j) {
          matrix[i]![j] = 1;
        } else {
          matrix[i]![j] = this.getAssetCorrelation(dataI.symbol, dataJ.symbol);
        }
      }
    }
    
    return matrix;
  }

  // Упрощенное решение оптимизации Марковица
  private solveMarkowitzOptimization(
    expectedReturns: number[],
    covarianceMatrix: number[][],
    targetReturn: number
  ): number[] {
    
    const n = expectedReturns.length;
    
    // Простая эвристика для демонстрации
    // В реальном приложении здесь будет использоваться квадратичное программирование
    
    const weights: number[] = Array(n).fill(1 / n); // Начинаем с равных весов
    
    // Корректируем веса на основе ожидаемой доходности и риска
    for (let i = 0; i < n; i++) {
      const expectedReturn = expectedReturns[i]!;
      const covariance = covarianceMatrix[i]![i]!;
      const sharpeRatio = expectedReturn / Math.sqrt(covariance);
      weights[i] = sharpeRatio * 0.5 + 0.5 / n; // Взвешиваем по Шарпу
    }
    
    // Нормализуем веса
    const sum = weights.reduce((acc, w) => acc + w, 0);
    return weights.map(w => w / sum);
  }

  // Расчет весов для паритета риска
  private calculateRiskParityWeights(volatilities: number[], correlationMatrix: number[][]): number[] {
    const n = volatilities.length;
    const weights: number[] = Array(n).fill(0);
    
    // Простая эвристика: вес обратно пропорционален волатильности
    const inverseVolatilities = volatilities.map(v => 1 / v);
    const sum = inverseVolatilities.reduce((acc, iv) => acc + iv, 0);
    
    return inverseVolatilities.map(iv => iv / sum);
  }

  // Формирование результата оптимизации
  private buildOptimizationResult(
    currentPositions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    totalPortfolioValue: number,
    historicalData: HistoricalData[],
    optimizedWeights: number[]
  ): PortfolioOptimizationResult {
    
    const allocation: AssetAllocation[] = [];
    let totalExpectedReturn = 0;
    let totalRisk = 0;
    
    // Расчет текущих весов и рекомендаций
    currentPositions.forEach((position, index) => {
      const currentValue = position.quantity * position.currentPrice;
      const currentWeight = currentValue / totalPortfolioValue;
      const targetWeight = optimizedWeights[index]!;
      
      const historicalDataItem = historicalData[index]!;
      const expectedReturn = historicalDataItem.averageReturn;
      const risk = historicalDataItem.volatility;
      const sharpeRatio = expectedReturn / risk;
      
      // Определяем рекомендуемое действие
      let recommendedAction: 'BUY' | 'SELL' | 'HOLD';
      const weightDifference = targetWeight - currentWeight;
      
      if (Math.abs(weightDifference) < 0.01) { // 1% порог
        recommendedAction = 'HOLD';
      } else if (weightDifference > 0) {
        recommendedAction = 'BUY';
      } else {
        recommendedAction = 'SELL';
      }
      
      // Расчет количества для торговли
      const targetValue = totalPortfolioValue * targetWeight;
      const quantityToTrade = recommendedAction === 'BUY'
        ? Math.floor((targetValue - currentValue) / position.currentPrice)
        : Math.floor((currentValue - targetValue) / position.currentPrice);
      
      allocation.push({
        symbol: position.symbol,
        targetWeight: targetWeight * 100,
        currentWeight: currentWeight * 100,
        recommendedAction,
        quantityToTrade: Math.abs(quantityToTrade),
        expectedReturn: expectedReturn * 100,
        risk: risk * 100,
        sharpeRatio
      });
      
      totalExpectedReturn += expectedReturn * targetWeight;
      totalRisk += Math.pow(risk * targetWeight, 2);
    });
    
    // Расчет общего риска портфеля (с учетом корреляций)
    totalRisk = Math.sqrt(totalRisk);
    
    // Генерация эффективной границы
    const efficientFrontier = this.generateEfficientFrontier(historicalData);
    
    return {
      optimizedAllocation: allocation,
      expectedPortfolioReturn: totalExpectedReturn * 100,
      expectedPortfolioRisk: totalRisk * 100,
      sharpeRatio: totalExpectedReturn / totalRisk,
      efficientFrontier,
      rebalancingNeeded: allocation.some(a => a.recommendedAction !== 'HOLD'),
      totalRebalancingCost: this.calculateRebalancingCost(allocation, totalPortfolioValue)
    };
  }

  // Вспомогательные методы

  private getTargetReturn(riskTolerance: string): number {
    const returns: { [key: string]: number } = {
      'LOW': 0.08,    // 8% годовых
      'MEDIUM': 0.12, // 12% годовых  
      'HIGH': 0.18    // 18% годовых
    };
    return returns[riskTolerance] || 0.12;
  }

  private getAssetCorrelation(symbol1: string, symbol2: string): number {
    // Упрощенные корреляции для демонстрации
    const correlations: { [key: string]: number } = {
      'SBER_GAZP': 0.6,
      'SBER_LKOH': 0.5,
      'SBER_VTBR': 0.7,
      'GAZP_LKOH': 0.4,
      'GAZP_VTBR': 0.3,
      'LKOH_VTBR': 0.2
    };
    
    const key = [symbol1, symbol2].sort().join('_');
    return correlations[key] || 0.3;
  }

  private async getHistoricalDataForAssets(symbols: string[]): Promise<HistoricalData[]> {
    // Мок-данные для демонстрации
    return symbols.map(symbol => ({
      symbol,
      returns: Array(100).fill(0).map(() => (Math.random() - 0.5) * 0.1), // ±5% дневные возвраты
      prices: Array(100).fill(0).map((_, i) => 100 + i * 0.1 + (Math.random() - 0.5) * 10),
      volatility: 0.02 + Math.random() * 0.03, // 2-5% волатильность
      averageReturn: 0.0005 + Math.random() * 0.001 // 0.05-0.15% средний дневной возврат
    }));
  }

  private generateInvestorViews(historicalData: HistoricalData[]): any[] {
    // Генерация взглядов инвестора на основе ML-прогнозов
    return historicalData.map(data => ({
      symbol: data.symbol,
      expectedReturn: data.averageReturn * (1 + (Math.random() - 0.5) * 0.5), // ±25% корректировка
      confidence: 0.7 + Math.random() * 0.3 // 70-100% уверенность
    }));
  }

  private blendEquilibriumAndViews(equilibriumReturns: number[], views: any[], historicalData: HistoricalData[]): number[] {
    // Упрощенное объединение равновесных доходностей и взглядов
    return equilibriumReturns.map((eqReturn, index) => {
      const view = views[index];
      const blendWeight = view.confidence;
      return eqReturn * (1 - blendWeight) + view.expectedReturn * blendWeight;
    });
  }

  private generateEfficientFrontier(historicalData: HistoricalData[]): Array<{ return: number; risk: number }> {
    // Генерация точек эффективной границы
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const returnVal = 0.05 + i * 0.02; // 5-25% доходность
      const risk = 0.1 + i * 0.03; // 10-40% риск
      points.push({ return: returnVal * 100, risk: risk * 100 });
    }
    return points;
  }

  private calculateRebalancingCost(allocation: AssetAllocation[], totalPortfolioValue: number): number {
    // Расчет стоимости ребалансировки (комиссии + проскальзывание)
    const commissionRate = 0.001; // 0.1% комиссия
    const slippageRate = 0.0005; // 0.05% проскальзывание
    
    const totalTradedValue = allocation
      .filter(a => a.recommendedAction !== 'HOLD')
      .reduce((sum, a) => sum + (a.quantityToTrade * this.getCurrentPrice(a.symbol)), 0);
    
    return totalTradedValue * (commissionRate + slippageRate);
  }

  private getCurrentPrice(symbol: string): number {
    const prices: { [key: string]: number } = {
      'SBER': 280.50,
      'GAZP': 162.30,
      'LKOH': 7480.25,
      'VTBR': 0.0248,
      'ROSN': 548.75
    };
    return prices[symbol] || 100;
  }
}