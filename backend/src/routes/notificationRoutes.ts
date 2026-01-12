import { Router, Request, Response } from 'express';
import { NotificationService, Notification, PriceAlert } from '../services/NotificationService';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
const notificationService = new NotificationService();

/**
 * Получение уведомлений пользователя
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const notifications = await notificationService.getUserNotifications(userId);
    
    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Ошибка получения уведомлений:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось получить уведомления'
    });
  }
});

/**
 * Отметить уведомление как прочитанное
 */
router.patch('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID уведомления обязателен'
      });
    }
    
    await notificationService.markAsRead(userId, id);
    
    return res.json({
      success: true,
      message: 'Уведомление отмечено как прочитанное'
    });
  } catch (error) {
    console.error('Ошибка отметки уведомления:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось отметить уведомление как прочитанное'
    });
  }
});

/**
 * Удалить уведомление
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID уведомления обязателен'
      });
    }
    
    await notificationService.deleteNotification(userId, id);
    
    return res.json({
      success: true,
      message: 'Уведомление удалено'
    });
  } catch (error) {
    console.error('Ошибка удаления уведомления:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось удалить уведомление'
    });
  }
});

/**
 * Получение алертов по ценам
 */
router.get('/price-alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const alerts = await notificationService.getUserPriceAlerts(userId);
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Ошибка получения алертов по ценам:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось получить алерты по ценам'
    });
  }
});

/**
 * Создание алерта по цене
 */
router.post('/price-alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { assetSymbol, condition, threshold, currentPrice } = req.body;
    
    if (!assetSymbol || !condition || threshold === undefined || currentPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Необходимы все параметры: assetSymbol, condition, threshold, currentPrice'
      });
    }
    
    const alert = await notificationService.createPriceAlert(userId, {
      assetSymbol,
      condition,
      threshold,
      currentPrice,
    });
    
    return res.json({
      success: true,
      data: alert,
      message: 'Алерт по цене создан'
    });
  } catch (error) {
    console.error('Ошибка создания алерта по цене:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось создать алерт по цене'
    });
  }
});

/**
 * Удаление алерта по цене
 */
router.delete('/price-alerts/:assetSymbol', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { assetSymbol } = req.params;
    
    if (!assetSymbol) {
      return res.status(400).json({
        success: false,
        message: 'Символ актива обязателен'
      });
    }
    
    await notificationService.deletePriceAlert(userId, assetSymbol);
    
    return res.json({
      success: true,
      message: 'Алерт по цене удален'
    });
  } catch (error) {
    console.error('Ошибка удаления алерта по цене:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось удалить алерт по цене'
    });
  }
});

/**
 * Проверка всех уведомлений для пользователя
 */
router.post('/check', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    await notificationService.checkAllNotifications(userId);
    
    const notifications = await notificationService.getUserNotifications(userId);
    
    res.json({
      success: true,
      data: notifications,
      message: 'Проверка уведомлений завершена'
    });
  } catch (error) {
    console.error('Ошибка проверки уведомлений:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось проверить уведомления'
    });
  }
});

/**
 * Очистка старых уведомлений
 */
router.post('/cleanup', authenticateToken, async (req: Request, res: Response) => {
  try {
    await notificationService.cleanupOldNotifications();
    
    res.json({
      success: true,
      message: 'Старые уведомления очищены'
    });
  } catch (error) {
    console.error('Ошибка очистки уведомлений:', error);
    res.status(500).json({
      success: false,
      message: 'Не удалось очистить уведомления'
    });
  }
});

export default router;