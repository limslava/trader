import { WebSocketService } from './WebSocketService';
import { MarketDataService } from './MarketDataService';
import { AnalysisService } from './AnalysisService';
import { RiskManagementService } from './RiskManagementService';

export interface PushNotificationTrigger {
  symbol: string;
  type: 'price_alert' | 'recommendation' | 'risk_alert' | 'portfolio_update';
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  data?: Record<string, any>;
}

export class PushNotificationService {
  private webSocketService: WebSocketService;
  private marketDataService: MarketDataService;
  private analysisService: AnalysisService;
  private riskManagementService: RiskManagementService;

  constructor(
    webSocketService: WebSocketService,
    marketDataService: MarketDataService,
    analysisService: AnalysisService,
    riskManagementService: RiskManagementService
  ) {
    this.webSocketService = webSocketService;
    this.marketDataService = marketDataService;
    this.analysisService = analysisService;
    this.riskManagementService = riskManagementService;
    
    this.setupNotificationTriggers();
  }

  private setupNotificationTriggers() {
    // Мониторинг значительных изменений цен
    this.setupPriceAlertTriggers();
    
    // Мониторинг рекомендаций анализа
    this.setupAnalysisTriggers();
    
    // Мониторинг рисков
    this.setupRiskTriggers();
  }

  private setupPriceAlertTriggers() {
    // Мониторинг изменений цен через регулярные проверки
    setInterval(async () => {
      await this.checkMarketPriceAlerts();
    }, 30000); // Проверка каждые 30 секунд
  }

  private setupAnalysisTriggers() {
    // Анализ будет запускаться по запросу или по расписанию
    setInterval(async () => {
      await this.checkAnalysisAlerts();
    }, 60000); // Проверка каждую минуту
  }

  private setupRiskTriggers() {
    // Мониторинг рисков по расписанию
    setInterval(async () => {
      await this.checkRiskAlerts();
    }, 45000); // Проверка каждые 45 секунд
  }

  private async checkMarketPriceAlerts() {
    try {
      const popularAssets = ['SBER', 'GAZP', 'LKOH', 'BTCUSDT', 'ETHUSDT'];
      
      for (const symbol of popularAssets) {
        const priceData = await this.marketDataService.getPrice(symbol);
        if (priceData) {
          await this.checkPriceAlertsForSymbol({
            symbol,
            price: priceData.price,
            changePercent: priceData.changePercent,
            volume: priceData.volume
          });
        }
      }
    } catch (error) {
      console.error('Ошибка проверки рыночных алертов:', error);
    }
  }

  private async checkAnalysisAlerts() {
    try {
      const symbols = ['SBER', 'GAZP', 'BTCUSDT'];
      
      for (const symbol of symbols) {
        const analysis = await this.analysisService.analyzeAsset(symbol);
        if (analysis) {
          await this.checkAnalysisAlertsForSymbol(symbol, analysis);
        }
      }
    } catch (error) {
      console.error('Ошибка проверки алертов анализа:', error);
    }
  }

  private async checkRiskAlerts() {
    try {
      // Для демо используем тестового пользователя
      const testUserId = 'test-user-123';
      const riskAssessment = await this.riskManagementService.assessPortfolioRisk(testUserId);
      
      if (riskAssessment.warnings.length > 0) {
        for (const warning of riskAssessment.warnings) {
          await this.checkRiskAlertsForWarning(warning);
        }
      }
    } catch (error) {
      console.error('Ошибка проверки рисковых алертов:', error);
    }
  }

  private async checkPriceAlertsForSymbol(data: { symbol: string; price: number; changePercent: number; volume: number }) {
    const { symbol, price, changePercent, volume } = data;

    // Алерт при значительном изменении цены (>5%)
    if (Math.abs(changePercent) > 5) {
      const direction = changePercent > 0 ? 'рост' : 'падение';
      const notification: PushNotificationTrigger = {
        symbol,
        type: 'price_alert',
        title: `Значительное изменение цены: ${symbol}`,
        body: `${symbol}: ${direction} на ${Math.abs(changePercent).toFixed(2)}% до ${price}`,
        priority: 'high',
        data: {
          symbol,
          currentPrice: price,
          changePercent,
          volume,
          alertType: 'price_movement'
        }
      };
      
      await this.triggerNotification(notification);
    }

    // Алерт при аномально высоком объеме
    const avgVolume = await this.getAverageVolume(symbol);
    if (volume > avgVolume * 3) {
      const notification: PushNotificationTrigger = {
        symbol,
        type: 'price_alert',
        title: `Аномальный объем: ${symbol}`,
        body: `${symbol}: объем торгов в ${(volume / avgVolume).toFixed(1)}x выше среднего`,
        priority: 'medium',
        data: {
          symbol,
          currentVolume: volume,
          averageVolume: avgVolume,
          volumeRatio: volume / avgVolume,
          alertType: 'volume_spike'
        }
      };
      
      await this.triggerNotification(notification);
    }
  }

  private async checkAnalysisAlertsForSymbol(symbol: string, analysis: any) {
    const { recommendation, confidence, reasoning } = analysis;

    // Алерт для сильных рекомендаций (уверенность > 70%)
    if (confidence > 70) {
      const action = this.getRecommendationAction(recommendation);
      const notification: PushNotificationTrigger = {
        symbol,
        type: 'recommendation',
        title: `Сильная рекомендация: ${symbol}`,
        body: `${symbol}: ${action} с уверенностью ${confidence}% - ${reasoning}`,
        priority: 'high',
        data: {
          symbol,
          recommendation,
          confidence,
          reasoning,
          alertType: 'strong_recommendation'
        }
      };
      
      await this.triggerNotification(notification);
    }

    // Алерт при смене тренда рекомендаций
    const previousAnalysis = await this.getPreviousAnalysis(symbol);
    if (previousAnalysis && previousAnalysis.recommendation !== recommendation) {
      const notification: PushNotificationTrigger = {
        symbol,
        type: 'recommendation',
        title: `Смена рекомендации: ${symbol}`,
        body: `${symbol}: ${this.getRecommendationAction(previousAnalysis.recommendation)} → ${this.getRecommendationAction(recommendation)}`,
        priority: 'medium',
        data: {
          symbol,
          previousRecommendation: previousAnalysis.recommendation,
          currentRecommendation: recommendation,
          confidence,
          alertType: 'recommendation_change'
        }
      };
      
      await this.triggerNotification(notification);
    }
  }

  private async checkRiskAlertsForWarning(warning: any) {
    const { type, severity, title, description, affectedAsset } = warning;

    // Алерт при высоком уровне риска
    if (severity === 'critical') {
      const notification: PushNotificationTrigger = {
        symbol: affectedAsset || 'PORTFOLIO',
        type: 'risk_alert',
        title: `Высокий риск: ${affectedAsset || 'Портфель'}`,
        body: `${title}: ${description}`,
        priority: 'high',
        data: {
          symbol: affectedAsset,
          riskLevel: severity,
          message: description,
          alertType: 'high_risk'
        }
      };
      
      await this.triggerNotification(notification);
    }

    // Алерт при нарушении лимитов риска
    if (type === 'stop_loss_breach' || type === 'position_size') {
      const notification: PushNotificationTrigger = {
        symbol: affectedAsset || 'PORTFOLIO',
        type: 'risk_alert',
        title: `Превышение лимита риска: ${affectedAsset || 'Портфель'}`,
        body: `${title}: ${description}`,
        priority: 'high',
        data: {
          symbol: affectedAsset,
          riskType: type,
          message: description,
          alertType: 'risk_limit_exceeded'
        }
      };
      
      await this.triggerNotification(notification);
    }
  }

  private async triggerNotification(notification: PushNotificationTrigger) {
    try {
      // Отправляем уведомление через WebSocket
      this.webSocketService.broadcastRecommendation({
        symbol: notification.symbol,
        type: 'push_notification',
        title: notification.title,
        message: notification.body,
        priority: notification.priority,
        data: notification.data
      });
      
      console.log(`Push notification triggered: ${notification.title}`, {
        symbol: notification.symbol,
        type: notification.type,
        priority: notification.priority
      });

      // Здесь можно добавить интеграцию с внешними сервисами push-уведомлений
      // например, Firebase Cloud Messaging, OneSignal и т.д.

    } catch (error) {
      console.error('Error triggering push notification:', error);
    }
  }

  private getRecommendationAction(recommendation: string): string {
    const actions: Record<string, string> = {
      'STRONG_BUY': 'СИЛЬНО ПОКУПАТЬ',
      'BUY': 'ПОКУПАТЬ',
      'HOLD': 'ДЕРЖАТЬ',
      'SELL': 'ПРОДАВАТЬ',
      'STRONG_SELL': 'СИЛЬНО ПРОДАВАТЬ'
    };
    return actions[recommendation] || recommendation;
  }

  private async getAverageVolume(symbol: string): Promise<number> {
    // Здесь должна быть логика получения среднего объема за период
    // Для демо возвращаем фиксированное значение
    const defaultVolumes: Record<string, number> = {
      'SBER': 1000000,
      'GAZP': 2000000,
      'LKOH': 500000,
      'BTCUSDT': 50000,
      'ETHUSDT': 30000
    };
    return defaultVolumes[symbol] || 100000;
  }

  private async getPreviousAnalysis(symbol: string): Promise<any> {
    // Здесь должна быть логика получения предыдущего анализа
    // Для демо возвращаем null
    return null;
  }

  // Метод для ручной отправки уведомлений
  async sendManualNotification(notification: Omit<PushNotificationTrigger, 'type'>) {
    const fullNotification: PushNotificationTrigger = {
      ...notification,
      type: 'price_alert' // default type
    };
    
    await this.triggerNotification(fullNotification);
  }
}