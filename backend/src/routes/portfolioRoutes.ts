import { Router, Request, Response } from 'express';
import { PostgresPortfolioService } from '../services/PostgresPortfolioService';
import { authenticateToken } from '../middleware/authMiddleware';

interface ITransactionInput {
  userId: string;
  assetSymbol: string;
  assetType: string;
  transactionType: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission?: number;
  timestamp: Date;
  status: string;
  notes?: string;
}

const router = Router();
const portfolioService = new PostgresPortfolioService();

/**
 * @route GET /api/portfolio
 * @desc Получить портфель пользователя
 * @access Private
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const positions = await portfolioService.getUserPortfolio(userId);
    const summary = await portfolioService.getPortfolioSummary(userId);
    
    // Рассчитываем реальные денежные средства
    const cashBalance = await portfolioService.calculateCashBalance(userId);
    
    // Создаем полную сводку портфеля
    const portfolio = {
      totalValue: summary.totalValue,
      totalCost: summary.totalValue - summary.totalProfitLoss, // Приблизительная стоимость покупки
      totalProfitLoss: summary.totalProfitLoss,
      totalProfitLossPercentage: summary.totalProfitLossPercentage,
      positions: positions,
      cashBalance: cashBalance,
      assetCount: summary.assetCount
    };
    
    res.json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    console.error('Ошибка получения портфеля:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось получить данные портфеля'
    });
  }
});

/**
 * @route GET /api/portfolio/transactions
 * @desc Получить историю транзакций
 * @access Private
 */
router.get('/transactions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const transactions = await portfolioService.getUserTransactions(userId);
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Ошибка получения истории транзакций:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось получить историю транзакций'
    });
  }
});

/**
 * @route POST /api/portfolio/transactions
 * @desc Добавить новую транзакцию
 * @access Private
 */
router.post('/transactions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const {
      assetSymbol,
      assetType,
      transactionType,
      quantity,
      price,
      commission = 0,
      notes
    } = req.body;

    // Валидация обязательных полей
    if (!assetSymbol || !assetType || !transactionType || !quantity || !price) {
      res.status(400).json({
        success: false,
        message: 'Необходимо указать все обязательные поля: assetSymbol, assetType, transactionType, quantity, price'
      });
      return;
    }

    // Валидация типов
    if (!['stock', 'crypto', 'currency'].includes(assetType)) {
      res.status(400).json({
        success: false,
        message: 'Некорректный тип актива. Допустимые значения: stock, crypto, currency'
      });
      return;
    }

    if (!['buy', 'sell'].includes(transactionType)) {
      res.status(400).json({
        success: false,
        message: 'Некорректный тип транзакции. Допустимые значения: buy, sell'
      });
      return;
    }

    if (quantity <= 0) {
      res.status(400).json({
        success: false,
        message: 'Количество должно быть больше 0'
      });
      return;
    }

    if (price <= 0) {
      res.status(400).json({
        success: false,
        message: 'Цена должна быть больше 0'
      });
      return;
    }

    const transactionData: ITransactionInput = {
      userId,
      assetSymbol,
      assetType,
      transactionType,
      quantity,
      price,
      commission,
      timestamp: new Date(),
      status: 'completed',
      notes
    };

    const result = await portfolioService.addToPortfolio(
      userId,
      assetSymbol,
      assetSymbol,
      quantity,
      price,
      transactionType.toUpperCase() as 'BUY' | 'SELL',
      assetType.toLowerCase(),
      notes
    );
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message
      });
      return;
    }

    // Получаем последнюю транзакцию для возврата
    const transactions = await portfolioService.getUserTransactions(userId);
    const latestTransaction = transactions[0];

    res.status(201).json({
      success: true,
      message: result.message,
      data: latestTransaction
    });
  } catch (error) {
    console.error('Ошибка добавления транзакции:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось добавить транзакцию'
    });
  }
});

/**
 * @route GET /api/portfolio/stats
 * @desc Получить статистику портфеля
 * @access Private
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const stats = await portfolioService.getPortfolioSummary(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Ошибка получения статистики портфеля:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось получить статистику портфеля'
    });
  }
});

/**
 * @route DELETE /api/portfolio/transactions/:id
 * @desc Удалить транзакцию (только для временного хранилища)
 * @access Private
 */
router.delete('/transactions/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    // В реальной системе это должно быть реализовано через MongoDB
    // Сейчас просто возвращаем сообщение
    res.json({
      success: true,
      message: 'Функция удаления транзакций доступна только при подключенной базе данных'
    });
  } catch (error) {
    console.error('Ошибка удаления транзакции:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось удалить транзакцию'
    });
  }
});

/**
 * @route POST /api/portfolio/update-prices
 * @desc Обновить цены портфеля с реальными котировками
 * @access Private
 */
router.post('/update-prices', authenticateToken, async (req: Request, res: Response) => {
  try {
    await portfolioService.updatePortfolioPrices();
    
    res.json({
      success: true,
      message: 'Цены портфеля успешно обновлены с актуальными котировками'
    });
  } catch (error) {
    console.error('Ошибка обновления цен портфеля:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось обновить цены портфеля'
    });
  }
});

export default router;