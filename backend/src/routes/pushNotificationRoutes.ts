import express from 'express';
import { PushNotificationService } from '../services/PushNotificationService';
import { WebSocketService } from '../services/WebSocketService';
import { MarketDataService } from '../services/MarketDataService';
import { AnalysisService } from '../services/AnalysisService';
import { RiskManagementService } from '../services/RiskManagementService';

const router = express.Router();

// Инициализация сервисов для тестирования
const webSocketService = new WebSocketService();
const marketDataService = new MarketDataService();
const analysisService = new AnalysisService();
const riskManagementService = new RiskManagementService();

const pushNotificationService = new PushNotificationService(
  webSocketService,
  marketDataService,
  analysisService,
  riskManagementService
);

/**
 * Отправка тестового push-уведомления
 */
router.post('/test', async (req, res) => {
  try {
    const { type, symbol, message } = req.body;

    let notification;
    
    switch (type) {
      case 'price_alert':
        notification = {
          symbol: symbol || 'SBER',
          title: 'Тестовое уведомление о цене',
          body: message || `Акция ${symbol || 'SBER'} показала значительное изменение`,
          priority: 'high' as const,
          data: {
            symbol: symbol || 'SBER',
            currentPrice: 280.50,
            changePercent: 5.2,
            alertType: 'test_price_movement'
          }
        };
        break;
        
      case 'recommendation':
        notification = {
          symbol: symbol || 'GAZP',
          title: 'Тестовая рекомендация',
          body: message || `Рекомендация для ${symbol || 'GAZP'}: ПОКУПАТЬ с уверенностью 85%`,
          priority: 'medium' as const,
          data: {
            symbol: symbol || 'GAZP',
            recommendation: 'BUY',
            confidence: 85,
            alertType: 'test_recommendation'
          }
        };
        break;
        
      case 'risk_alert':
        notification = {
          symbol: symbol || 'PORTFOLIO',
          title: 'Тестовое предупреждение о риске',
          body: message || 'Обнаружен высокий уровень риска в портфеле',
          priority: 'high' as const,
          data: {
            symbol: symbol || 'PORTFOLIO',
            riskLevel: 'HIGH',
            alertType: 'test_risk_warning'
          }
        };
        break;
        
      default:
        notification = {
          symbol: 'TEST',
          title: 'Тестовое уведомление',
          body: message || 'Это тестовое push-уведомление',
          priority: 'low' as const,
          data: {
            alertType: 'test_general'
          }
        };
    }

    await pushNotificationService.sendManualNotification(notification);

    res.json({
      success: true,
      message: 'Тестовое уведомление отправлено',
      notification
    });
  } catch (error) {
    console.error('Ошибка отправки тестового уведомления:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось отправить тестовое уведомление'
    });
  }
});

/**
 * Получение статуса push-уведомлений
 */
router.get('/status', (req, res) => {
  res.json({
    pushNotifications: {
      enabled: true,
      service: 'WebSocket + Browser Notifications',
      features: [
        'Price alerts (>5% changes)',
        'Volume spike alerts',
        'Strong recommendations (>70% confidence)',
        'Risk warnings',
        'Portfolio alerts'
      ],
      monitoring: {
        priceChecks: 'Every 30 seconds',
        analysisChecks: 'Every minute',
        riskChecks: 'Every 45 seconds'
      }
    }
  });
});

export default router;