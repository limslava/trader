import express from 'express';
import { mlPredictionService } from '../services/MLPredictionService';
import { RealMLPredictionService } from '../services/RealMLPredictionService';

const router = express.Router();

/**
 * Получить ML прогноз для актива
 */
router.get('/prediction/:symbol', async (req, res): Promise<any> => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1d' } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Не указан символ актива'
      });
    }

    const prediction = await mlPredictionService.getPrediction(
      symbol.toUpperCase(),
      timeframe as any
    );

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: `Прогноз для ${symbol} не найден`
      });
    }

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Ошибка получения ML прогноза:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения ML прогноза'
    });
  }
});

/**
 * Получить РЕАЛЬНЫЙ ML прогноз для актива с улучшенным техническим анализом
 */
router.get('/real-prediction/:symbol', async (req, res): Promise<any> => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1d' } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Не указан символ актива'
      });
    }

    const realMLService = new RealMLPredictionService();
    const prediction = await realMLService.getPrediction(
      symbol.toUpperCase(),
      timeframe as any
    );

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: `Реальный прогноз для ${symbol} не найден`
      });
    }

    res.json({
      success: true,
      data: prediction,
      metadata: {
        type: 'REAL_ML_PREDICTION',
        algorithm: 'Enhanced Technical Analysis',
        features: ['RSI', 'MACD', 'Moving Averages', 'Volume Analysis', 'Pattern Recognition'],
        cacheStatus: 'ACTIVE'
      }
    });
  } catch (error) {
    console.error('Ошибка получения реального ML прогноза:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения реального ML прогноза'
    });
  }
});

/**
 * Получить технические паттерны для актива
 */
router.get('/patterns/:symbol', async (req, res): Promise<any> => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Не указан символ актива'
      });
    }

    const patterns = await mlPredictionService.getTechnicalPatterns(symbol.toUpperCase());

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        patterns,
        count: patterns.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка получения технических паттернов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения технических паттернов'
    });
  }
});

/**
 * Получить анализ сентимента для актива
 */
router.get('/sentiment/:symbol', async (req, res): Promise<any> => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Не указан символ актива'
      });
    }

    const sentiment = await mlPredictionService.analyzeSentiment(symbol.toUpperCase());

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        sentiment,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка анализа сентимента:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка анализа сентимента'
    });
  }
});

/**
 * Получить ML рекомендации для начинающих
 */
router.get('/recommendations/beginner', async (req, res) => {
  try {
    const recommendations = await mlPredictionService.getBeginnerRecommendations();

    res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
        timestamp: new Date().toISOString(),
        description: 'ML рекомендации для начинающих трейдеров (фильтр по уверенности > 60%)'
      }
    });
  } catch (error) {
    console.error('Ошибка получения ML рекомендаций:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения ML рекомендаций'
    });
  }
});

/**
 * Получить расширенный анализ актива
 */
router.get('/analysis/:symbol', async (req, res): Promise<any> => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1d' } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Не указан символ актива'
      });
    }

    const upperSymbol = symbol.toUpperCase();

    // Параллельное получение всех данных
    const [prediction, patterns, sentiment] = await Promise.all([
      mlPredictionService.getPrediction(upperSymbol, timeframe as any),
      mlPredictionService.getTechnicalPatterns(upperSymbol),
      mlPredictionService.analyzeSentiment(upperSymbol)
    ]);

    const analysis = {
      symbol: upperSymbol,
      timeframe,
      prediction,
      technicalAnalysis: {
        patterns,
        patternCount: patterns.length,
        bullishPatterns: patterns.filter(p => p.direction === 'BULLISH').length,
        bearishPatterns: patterns.filter(p => p.direction === 'BEARISH').length,
        neutralPatterns: patterns.filter(p => p.direction === 'NEUTRAL').length
      },
      sentimentAnalysis: sentiment,
      overallScore: calculateOverallScore(prediction, patterns, sentiment),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Ошибка расширенного анализа:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка расширенного анализа'
    });
  }
});

/**
 * Очистить ML кэш
 */
router.delete('/cache', async (req, res) => {
  try {
    const { symbol } = req.query;

    if (symbol) {
      await mlPredictionService.invalidateMLCache(symbol as string);
      res.json({
        success: true,
        message: `ML кэш для ${symbol} очищен`,
        data: { symbol }
      });
    } else {
      await mlPredictionService.invalidateMLCache();
      res.json({
        success: true,
        message: 'Весь ML кэш очищен',
        data: { timestamp: new Date().toISOString() }
      });
    }
  } catch (error) {
    console.error('Ошибка очистки ML кэша:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка очистки ML кэша'
    });
  }
});

/**
 * Получить статус ML сервиса
 */
router.get('/status', async (req, res) => {
  try {
    // Проверка работы сервиса через получение прогноза для тестового символа
    const testPrediction = await mlPredictionService.getPrediction('SBER', '1d');
    
    res.json({
      success: true,
      data: {
        status: 'ACTIVE',
        service: 'ML Prediction Service',
        version: '1.0.0',
        testPrediction: testPrediction ? 'OK' : 'ERROR',
        timestamp: new Date().toISOString(),
        features: [
          'ML прогнозы цен',
          'Анализ технических паттернов', 
          'Сентимент анализ',
          'Рекомендации для начинающих',
          'Кэширование результатов'
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка проверки статуса ML сервиса:', error);
    res.status(500).json({
      success: false,
      error: 'ML сервис недоступен'
    });
  }
});

/**
 * Вспомогательная функция для расчета общего скора
 */
function calculateOverallScore(prediction: any, patterns: any[], sentiment: any): number {
  if (!prediction) return 0;

  let score = prediction.confidence / 100 * 0.5; // 50% от уверенности прогноза
  
  // Добавление веса от технических паттернов
  const patternScore = patterns.reduce((sum: number, pattern: any) => {
    return sum + (pattern.strength * pattern.probability *
      (pattern.direction === 'BULLISH' ? 1 : pattern.direction === 'BEARISH' ? -1 : 0));
  }, 0) / Math.max(patterns.length, 1);
  
  score += patternScore * 0.3; // 30% от технических паттернов
  
  // Добавление веса от сентимента
  score += sentiment.overall * 0.2; // 20% от сентимента

  return Math.max(-1, Math.min(1, score));
}

export default router;