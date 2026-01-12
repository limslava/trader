import express from 'express';
import CapitalManagementService from '../services/CapitalManagementService';

const router = express.Router();
const capitalService = new CapitalManagementService();

/**
 * GET /api/capital
 * Получить информацию о капитале пользователя
 */
router.get('/', async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    const capital = await capitalService.getUserCapital(userId);
    
    if (!capital) {
      return res.json({
        success: true,
        data: {
          initialCapital: 0,
          currentCapital: 0,
          availableCapital: 0
        }
      });
    }

    const availableCapital = await capitalService.getAvailableCapital(userId);

    return res.json({
      success: true,
      data: {
        initialCapital: capital.initialCapital,
        currentCapital: capital.currentCapital,
        availableCapital,
        createdAt: capital.createdAt,
        updatedAt: capital.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Ошибка получения капитала:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось получить информацию о капитале'
    });
  }
});

/**
 * POST /api/capital/initial
 * Установить стартовый капитал
 */
router.post('/initial', async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Некорректная сумма капитала'
      });
    }

    const result = await capitalService.setInitialCapital(userId, amount);

    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: {
          initialCapital: amount,
          currentCapital: amount
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Ошибка установки стартового капитала:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось установить стартовый капитал'
    });
  }
});

/**
 * POST /api/capital/deposit
 * Пополнить счет
 */
router.post('/deposit', async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Некорректная сумма пополнения'
      });
    }

    const result = await capitalService.deposit(userId, amount);

    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: {
          newBalance: result.newBalance,
          depositedAmount: amount
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Ошибка пополнения счета:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось пополнить счет'
    });
  }
});

/**
 * POST /api/capital/withdraw
 * Вывести средства
 */
router.post('/withdraw', async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Некорректная сумма вывода'
      });
    }

    const result = await capitalService.withdraw(userId, amount);

    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: {
          newBalance: result.newBalance,
          withdrawnAmount: amount
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Ошибка вывода средств:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось вывести средства'
    });
  }
});

/**
 * GET /api/capital/available
 * Получить доступные средства для торговли
 */
router.get('/available', async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    const availableCapital = await capitalService.getAvailableCapital(userId);

    res.json({
      success: true,
      data: {
        availableCapital
      }
    });
  } catch (error) {
    console.error('❌ Ошибка получения доступных средств:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось получить доступные средства'
    });
  }
});

/**
 * POST /api/capital/initialize
 * Инициализировать капитал для пользователя (для существующих пользователей)
 */
router.post('/initialize', async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    await capitalService.initializeUserCapital(userId);

    res.json({
      success: true,
      message: 'Капитал пользователя инициализирован'
    });
  } catch (error) {
    console.error('❌ Ошибка инициализации капитала:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось инициализировать капитал'
    });
  }
});

export default router;