import express from 'express';
import { AnalysisService } from '../services/AnalysisService';

const router = express.Router();
const analysisService = new AnalysisService();

// Полный анализ актива
router.get('/asset/:symbol', async (req: express.Request, res: express.Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        error: 'Не указан символ актива',
        message: 'Параметр symbol обязателен'
      });
    }

    const analysis = await analysisService.analyzeAsset(symbol.toUpperCase());

    if (!analysis) {
      return res.status(404).json({
        error: 'Не удалось проанализировать актив',
        symbol
      });
    }

    return res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Ошибка анализа актива:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось проанализировать актив'
    });
  }
});

// Анализ нескольких активов
router.post('/assets', async (req: express.Request, res: express.Response) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'Неверный формат запроса',
        message: 'Параметр symbols должен быть массивом символов'
      });
    }

    if (symbols.length > 20) {
      return res.status(400).json({
        error: 'Слишком много символов',
        message: 'Максимальное количество символов в одном запросе: 20'
      });
    }

    const analyses = await Promise.all(
      symbols.map(symbol => analysisService.analyzeAsset(symbol.toUpperCase()))
    );

    const validAnalyses = analyses.filter(analysis => analysis !== null);

    return res.json({
      success: true,
      data: validAnalyses,
      count: validAnalyses.length,
      failed: symbols.length - validAnalyses.length
    });

  } catch (error) {
    console.error('Ошибка анализа активов:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось проанализировать активы'
    });
  }
});

// Получение рекомендаций для новичка
router.get('/recommendations/beginner', async (req: express.Request, res: express.Response) => {
  try {
    // Популярные активы для новичков
    const beginnerSymbols = ['SBER', 'GAZP', 'LKOH', 'VTBR', 'BTCUSDT', 'ETHUSDT'];
    
    const analyses = await Promise.all(
      beginnerSymbols.map(symbol => analysisService.analyzeAsset(symbol))
    );

    const validAnalyses = analyses.filter(analysis => analysis !== null);
    
    // Сортируем по уверенности рекомендации
    const sortedAnalyses = validAnalyses.sort((a, b) => b!.confidence - a!.confidence);

    return res.json({
      success: true,
      data: sortedAnalyses,
      count: sortedAnalyses.length,
      description: 'Рекомендации для начинающих трейдеров (низкий риск, высокая ликвидность)'
    });

  } catch (error) {
    console.error('Ошибка получения рекомендаций:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить рекомендации'
    });
  }
});

// Анализ риска портфеля
router.post('/portfolio-risk', async (req: express.Request, res: express.Response) => {
  try {
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({
        error: 'Неверный формат запроса',
        message: 'Параметр positions должен быть массивом позиций'
      });
    }

    // Анализируем каждый актив в портфеле
    const positionAnalyses = await Promise.all(
      positions.map(async (position: any) => {
        const analysis = await analysisService.analyzeAsset(position.symbol);
        return {
          symbol: position.symbol,
          quantity: position.quantity,
          analysis: analysis
        };
      })
    );

    // Рассчитываем общий риск портфеля
    const totalRiskScore = positionAnalyses.reduce((sum, pos) => {
      const riskScore = pos.analysis?.riskLevel === 'HIGH' ? 70 :
                       pos.analysis?.riskLevel === 'MEDIUM' ? 50 : 30;
      return sum + (riskScore || 50);
    }, 0) / positionAnalyses.length;

    // Определяем уровень риска портфеля
    let portfolioRiskLevel;
    if (totalRiskScore >= 70) portfolioRiskLevel = 'VERY_HIGH';
    else if (totalRiskScore >= 60) portfolioRiskLevel = 'HIGH';
    else if (totalRiskScore >= 45) portfolioRiskLevel = 'MEDIUM';
    else if (totalRiskScore >= 35) portfolioRiskLevel = 'LOW';
    else portfolioRiskLevel = 'VERY_LOW';

    return res.json({
      success: true,
      data: {
        portfolioRisk: {
          score: Math.round(totalRiskScore),
          level: portfolioRiskLevel
        },
        positions: positionAnalyses,
        recommendations: generatePortfolioRecommendations(positionAnalyses)
      }
    });

  } catch (error) {
    console.error('Ошибка анализа риска портфеля:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось проанализировать риск портфеля'
    });
  }
});

// Генерация рекомендаций для портфеля
function generatePortfolioRecommendations(positionAnalyses: any[]): string[] {
  const recommendations: string[] = [];

  // Проверяем диверсификацию
  if (positionAnalyses.length < 5) {
    recommendations.push('Рекомендуется увеличить диверсификацию портфеля (минимум 5 активов)');
  }

  // Проверяем риск отдельных позиций
  const highRiskPositions = positionAnalyses.filter(pos =>
    pos.analysis?.riskLevel === 'HIGH'
  );

  if (highRiskPositions.length > 2) {
    recommendations.push('Слишком много высокорисковых активов в портфеле');
  }

  // Проверяем рекомендации по активам
  const sellRecommendations = positionAnalyses.filter(pos =>
    pos.analysis?.recommendation === 'SELL'
  );

  if (sellRecommendations.length > 0) {
    recommendations.push(`Рассмотрите возможность продажи ${sellRecommendations.length} активов с негативными рекомендациями`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Портфель выглядит сбалансированным. Продолжайте мониторить рынок.');
  }

  return recommendations;
}

// Получение рыночных инсайтов
router.get('/insights', async (req: express.Request, res: express.Response) => {
  try {
    // Анализируем ключевые активы для получения общей картины рынка
    const keyAssets = ['SBER', 'GAZP', 'LKOH', 'ROSN', 'BTCUSDT', 'ETHUSDT'];
    
    const analyses = await Promise.all(
      keyAssets.map(symbol => analysisService.analyzeAsset(symbol))
    );

    const validAnalyses = analyses.filter(analysis => analysis !== null);

    // Анализируем общие тренды
    const bullishCount = validAnalyses.filter(a =>
      a!.recommendation === 'BUY'
    ).length;

    const bearishCount = validAnalyses.filter(a =>
      a!.recommendation === 'SELL'
    ).length;

    let marketSentiment;
    if (bullishCount > bearishCount * 1.5) marketSentiment = 'BULLISH';
    else if (bearishCount > bullishCount * 1.5) marketSentiment = 'BEARISH';
    else marketSentiment = 'NEUTRAL';

    return res.json({
      success: true,
      data: {
        marketSentiment,
        bullishCount,
        bearishCount,
        neutralCount: validAnalyses.length - bullishCount - bearishCount,
        keyInsights: generateMarketInsights(validAnalyses),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Ошибка получения инсайтов:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить рыночные инсайты'
    });
  }
});

// Генерация рыночных инсайтов
function generateMarketInsights(analyses: any[]): string[] {
  const insights: string[] = [];

  // Анализируем технические индикаторы
  const rsiExtremes = analyses.filter(a =>
    a.technicalScore < 30 || a.technicalScore > 70
  ).length;

  if (rsiExtremes > analyses.length / 2) {
    insights.push('Многие активы находятся в зонах перекупленности/перепроданности');
  }

  // Анализируем тренды
  const uptrendCount = analyses.filter(a =>
    a.technicalScore > 60
  ).length;

  if (uptrendCount > analyses.length * 0.7) {
    insights.push('Преобладают восходящие тренды на рынке');
  } else if (uptrendCount < analyses.length * 0.3) {
    insights.push('Преобладают нисходящие тренды на рынке');
  }

  return insights;
}

export default router;