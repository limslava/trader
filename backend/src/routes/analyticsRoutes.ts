import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import AnalyticsReportService, { AnalyticsReport } from '../services/AnalyticsReportService';

const router = Router();
const analyticsService = new AnalyticsReportService();

// Получить все отчеты пользователя
router.get('/reports', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const reports = await analyticsService.getUserReports(userId);
    
    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Ошибка получения отчетов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения аналитических отчетов'
    });
  }
});

// Получить отчет по ID
router.get('/reports/:reportId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await analyticsService.getReport(reportId!);
    
    if (!report) {
      res.status(404).json({
        success: false,
        message: 'Отчет не найден'
      });
      return;
    }

    // Проверяем, что отчет принадлежит пользователю
    if (report.userId !== (req as any).user.userId) {
      res.status(403).json({
        success: false,
        message: 'Доступ к отчету запрещен'
      });
      return;
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Ошибка получения отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения отчета'
    });
  }
});

// Создать ежедневный отчет
router.post('/reports/daily', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    // В реальном приложении здесь нужно получить позиции портфеля из БД
    const mockPositions = [
      {
        assetSymbol: 'SBER',
        assetType: 'stock' as const,
        quantity: 10,
        averagePrice: 250,
        currentPrice: 280,
        totalCost: 2500,
        currentValue: 2800,
        profitLoss: 300,
        profitLossPercentage: 12
      },
      {
        assetSymbol: 'GAZP',
        assetType: 'stock' as const,
        quantity: 20,
        averagePrice: 160,
        currentPrice: 155,
        totalCost: 3200,
        currentValue: 3100,
        profitLoss: -100,
        profitLossPercentage: -3.1
      }
    ];

    const report = await analyticsService.generateDailyReport(userId, mockPositions);
    
    res.json({
      success: true,
      data: report,
      message: 'Ежедневный отчет успешно создан'
    });
  } catch (error) {
    console.error('Ошибка создания ежедневного отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания ежедневного отчета'
    });
  }
});

// Создать недельный отчет
router.post('/reports/weekly', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    const mockPositions = [
      {
        assetSymbol: 'SBER',
        assetType: 'stock' as const,
        quantity: 10,
        averagePrice: 250,
        currentPrice: 280,
        totalCost: 2500,
        currentValue: 2800,
        profitLoss: 300,
        profitLossPercentage: 12
      },
      {
        assetSymbol: 'GAZP',
        assetType: 'stock' as const,
        quantity: 20,
        averagePrice: 160,
        currentPrice: 155,
        totalCost: 3200,
        currentValue: 3100,
        profitLoss: -100,
        profitLossPercentage: -3.1
      },
      {
        assetSymbol: 'BTCUSDT',
        assetType: 'crypto' as const,
        quantity: 0.1,
        averagePrice: 45000,
        currentPrice: 48000,
        totalCost: 4500,
        currentValue: 4800,
        profitLoss: 300,
        profitLossPercentage: 6.7
      }
    ];

    const report = await analyticsService.generateWeeklyReport(userId, mockPositions);
    
    res.json({
      success: true,
      data: report,
      message: 'Недельный отчет успешно создан'
    });
  } catch (error) {
    console.error('Ошибка создания недельного отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания недельного отчета'
    });
  }
});

// Создать отчет по портфелю
router.post('/reports/portfolio', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    const mockPositions = [
      {
        assetSymbol: 'SBER',
        assetType: 'stock' as const,
        quantity: 10,
        averagePrice: 250,
        currentPrice: 280,
        totalCost: 2500,
        currentValue: 2800,
        profitLoss: 300,
        profitLossPercentage: 12
      },
      {
        assetSymbol: 'GAZP',
        assetType: 'stock' as const,
        quantity: 20,
        averagePrice: 160,
        currentPrice: 155,
        totalCost: 3200,
        currentValue: 3100,
        profitLoss: -100,
        profitLossPercentage: -3.1
      },
      {
        assetSymbol: 'LKOH',
        assetType: 'stock' as const,
        quantity: 5,
        averagePrice: 6500,
        currentPrice: 6800,
        totalCost: 32500,
        currentValue: 34000,
        profitLoss: 1500,
        profitLossPercentage: 4.6
      },
      {
        assetSymbol: 'BTCUSDT',
        assetType: 'crypto' as const,
        quantity: 0.1,
        averagePrice: 45000,
        currentPrice: 48000,
        totalCost: 4500,
        currentValue: 4800,
        profitLoss: 300,
        profitLossPercentage: 6.7
      },
      {
        assetSymbol: 'ETHUSDT',
        assetType: 'crypto' as const,
        quantity: 1,
        averagePrice: 3000,
        currentPrice: 3200,
        totalCost: 3000,
        currentValue: 3200,
        profitLoss: 200,
        profitLossPercentage: 6.7
      }
    ];

    const report = await analyticsService.generatePortfolioReport(userId, mockPositions);
    
    res.json({
      success: true,
      data: report,
      message: 'Отчет по портфелю успешно создан'
    });
  } catch (error) {
    console.error('Ошибка создания отчета по портфелю:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка создания отчета по портфелю'
    });
  }
});

// Удалить отчет
router.delete('/reports/:reportId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await analyticsService.getReport(reportId!);
    
    if (!report) {
      res.status(404).json({
        success: false,
        message: 'Отчет не найден'
      });
      return;
    }

    // Проверяем, что отчет принадлежит пользователю
    if (report.userId !== (req as any).user.userId) {
      res.status(403).json({
        success: false,
        message: 'Доступ к отчету запрещен'
      });
      return;
    }

    // В реальном приложении здесь нужно удалить отчет из БД
    // Пока просто возвращаем успех
    res.json({
      success: true,
      message: 'Отчет успешно удален'
    });
  } catch (error) {
    console.error('Ошибка удаления отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления отчета'
    });
  }
});

// Получить последний отчет определенного типа
router.get('/reports/latest/:type', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const userId = (req as any).user.userId;
    
    const reports = await analyticsService.getUserReports(userId);
    const latestReport = reports
      .filter(report => report.type === type!.toUpperCase())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    
    if (!latestReport) {
      res.status(404).json({
        success: false,
        message: `Отчет типа ${type} не найден`
      });
      return;
    }

    res.json({
      success: true,
      data: latestReport
    });
  } catch (error) {
    console.error('Ошибка получения последнего отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения последнего отчета'
    });
  }
});

export default router;