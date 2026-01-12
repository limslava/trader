import { Router, Request, Response } from 'express';
import { RiskManagementService, RiskAssessment, StopLossRecommendation } from '../services/RiskManagementService';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
const riskService = new RiskManagementService();

/**
 * Полная оценка рисков портфеля пользователя
 */
router.get('/assessment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const assessment = await riskService.assessPortfolioRisk(userId);
    
    res.json({
      success: true,
      data: assessment
    });
  } catch (error) {
    console.error('Ошибка оценки рисков:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось оценить риски портфеля'
    });
  }
});

/**
 * Рекомендации по стоп-лоссам
 */
router.get('/stop-loss-recommendations', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const recommendations = await riskService.getStopLossRecommendations(userId);
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Ошибка получения рекомендаций по стоп-лоссам:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось получить рекомендации по стоп-лоссам'
    });
  }
});

/**
 * Расчет максимального размера позиции
 */
router.get('/max-position-size', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { riskTolerance } = req.query;
    const userId = (req as any).user.userId;
    
    // Получаем общую стоимость портфеля
    const portfolioService = new (await import('../services/PortfolioService')).PortfolioService();
    const portfolio = await portfolioService.getPortfolio(userId);
    
    const maxSize = riskService.calculateMaxPositionSize(
      portfolio.totalValue,
      riskTolerance as 'low' | 'medium' | 'high' || 'low'
    );
    
    res.json({
      success: true,
      data: {
        maxPositionSize: maxSize,
        totalPortfolioValue: portfolio.totalValue,
        riskTolerance: riskTolerance || 'low',
        recommendation: `Максимальный размер позиции: ${Math.round(maxSize)} руб. (${Math.round(maxSize / portfolio.totalValue * 100)}% портфеля)`
      }
    });
  } catch (error) {
    console.error('Ошибка расчета максимального размера позиции:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось рассчитать максимальный размер позиции'
    });
  }
});

/**
 * Проверка риска для конкретной сделки
 */
router.post('/trade-risk-check', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { assetSymbol, assetType, quantity, price, transactionType } = req.body;
    const userId = (req as any).user.userId;
    
    if (!assetSymbol || !assetType || !quantity || !price || !transactionType) {
      return res.status(400).json({
        success: false,
        message: 'Необходимы все параметры: assetSymbol, assetType, quantity, price, transactionType'
      });
    }
    
    const portfolioService = new (await import('../services/PortfolioService')).PortfolioService();
    const portfolio = await portfolioService.getPortfolio(userId);
    
    const tradeValue = quantity * price;
    const maxPositionSize = riskService.calculateMaxPositionSize(portfolio.totalValue, 'low');
    
    const riskCheck = {
      tradeValue,
      maxPositionSize,
      isWithinLimits: tradeValue <= maxPositionSize,
      portfolioPercentage: (tradeValue / portfolio.totalValue) * 100,
      recommendation: tradeValue <= maxPositionSize
        ? 'Сделка соответствует рекомендациям риск-менеджмента'
        : `Сделка превышает рекомендуемый размер. Уменьшите количество до ${Math.floor(maxPositionSize / price)}`
    };
    
    return res.json({
      success: true,
      data: riskCheck
    });
  } catch (error) {
    console.error('Ошибка проверки риска сделки:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось проверить риск сделки'
    });
  }
});

/**
 * Получение статистики рисков
 */
router.get('/statistics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    const assessment = await riskService.assessPortfolioRisk(userId);
    const stopLossRecommendations = await riskService.getStopLossRecommendations(userId);
    
    // Получаем портфель для получения количества позиций
    const portfolioService = new (await import('../services/PortfolioService')).PortfolioService();
    const portfolio = await portfolioService.getPortfolio(userId);
    
    const statistics = {
      riskLevel: assessment.overallRiskLevel,
      riskScore: assessment.portfolioRiskScore,
      diversificationScore: Math.round(assessment.diversificationScore * 100),
      concentrationRisk: Math.round(assessment.concentrationRisk * 100),
      volatilityRisk: Math.round(assessment.volatilityRisk * 100),
      recommendationsCount: assessment.recommendations.length,
      warningsCount: assessment.warnings.length,
      criticalWarningsCount: assessment.warnings.filter(w => w.severity === 'critical').length,
      stopLossCoverage: Math.round((stopLossRecommendations.length / portfolio.positions.length || 1) * 100)
    };
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Ошибка получения статистики рисков:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось получить статистику рисков'
    });
  }
});

export default router;