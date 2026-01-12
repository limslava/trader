import { MarketDataService } from './MarketDataService';
import { RiskManagementService } from './RiskManagementService';
import { PortfolioService } from './PortfolioService';

export interface Notification {
  id: string;
  userId: string;
  type: 'price_alert' | 'risk_warning' | 'portfolio_change' | 'market_news' | 'system';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  data?: any;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface PriceAlert {
  assetSymbol: string;
  condition: 'above' | 'below' | 'change_percent';
  threshold: number;
  currentPrice: number;
  triggered: boolean;
}

export class NotificationService {
  private marketDataService: MarketDataService;
  private riskManagementService: RiskManagementService;
  private portfolioService: PortfolioService;

  // Временное хранилище для уведомлений (в реальном приложении - база данных)
  private notifications: Map<string, Notification[]> = new Map();
  private priceAlerts: Map<string, PriceAlert[]> = new Map();

  constructor() {
    this.marketDataService = new MarketDataService();
    this.riskManagementService = new RiskManagementService();
    this.portfolioService = new PortfolioService();
  }

  /**
   * Получение уведомлений пользователя
   */
  async getUserNotifications(userId: string): Promise<Notification[]> {
    const userNotifications = this.notifications.get(userId) || [];
    // Фильтруем просроченные уведомления
    const validNotifications = userNotifications.filter(notification => 
      !notification.expiresAt || notification.expiresAt > new Date()
    );
    
    // Обновляем хранилище
    this.notifications.set(userId, validNotifications);
    
    return validNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Создание нового уведомления
   */
  async createNotification(userId: string, notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>): Promise<Notification> {
    const newNotification: Notification = {
      id: this.generateId(),
      userId,
      ...notification,
      read: false,
      createdAt: new Date(),
    };

    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.push(newNotification);
    this.notifications.set(userId, userNotifications);

    return newNotification;
  }

  /**
   * Отметить уведомление как прочитанное
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId);
    if (userNotifications) {
      const notification = userNotifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read = true;
      }
    }
  }

  /**
   * Удалить уведомление
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const userNotifications = this.notifications.get(userId);
    if (userNotifications) {
      const filtered = userNotifications.filter(n => n.id !== notificationId);
      this.notifications.set(userId, filtered);
    }
  }

  /**
   * Создание алерта по цене
   */
  async createPriceAlert(userId: string, alert: Omit<PriceAlert, 'triggered'>): Promise<PriceAlert> {
    const newAlert: PriceAlert = {
      ...alert,
      triggered: false,
    };

    const userAlerts = this.priceAlerts.get(userId) || [];
    userAlerts.push(newAlert);
    this.priceAlerts.set(userId, userAlerts);

    return newAlert;
  }

  /**
   * Получение алертов пользователя
   */
  async getUserPriceAlerts(userId: string): Promise<PriceAlert[]> {
    return this.priceAlerts.get(userId) || [];
  }

  /**
   * Удаление алерта по цене
   */
  async deletePriceAlert(userId: string, assetSymbol: string): Promise<void> {
    const userAlerts = this.priceAlerts.get(userId);
    if (userAlerts) {
      const filtered = userAlerts.filter(alert => alert.assetSymbol !== assetSymbol);
      this.priceAlerts.set(userId, filtered);
    }
  }

  /**
   * Проверка и создание уведомлений на основе рисков
   */
  async checkRiskNotifications(userId: string): Promise<void> {
    try {
      const riskAssessment = await this.riskManagementService.assessPortfolioRisk(userId);

      // Создаем уведомления для критических предупреждений
      const criticalWarnings = riskAssessment.warnings.filter(w => w.severity === 'critical');
      for (const warning of criticalWarnings) {
        await this.createNotification(userId, {
          type: 'risk_warning',
          title: `Критическое предупреждение: ${warning.title}`,
          message: warning.description,
          severity: 'error',
          data: warning,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 часа
        });
      }

      // Создаем уведомления для рекомендаций с высоким приоритетом
      const highPriorityRecommendations = riskAssessment.recommendations.filter(r => r.priority === 'high');
      for (const recommendation of highPriorityRecommendations) {
        await this.createNotification(userId, {
          type: 'risk_warning',
          title: `Важная рекомендация: ${recommendation.title}`,
          message: recommendation.description,
          severity: 'warning',
          data: recommendation,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
        });
      }

      // Уведомление о низком уровне диверсификации
      if (riskAssessment.diversificationScore < 0.5) {
        await this.createNotification(userId, {
          type: 'portfolio_change',
          title: 'Низкая диверсификация портфеля',
          message: `Уровень диверсификации: ${Math.round(riskAssessment.diversificationScore * 100)}%. Рекомендуется добавить больше активов.`,
          severity: 'warning',
          data: { diversificationScore: riskAssessment.diversificationScore },
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 дня
        });
      }

    } catch (error) {
      console.error('Ошибка проверки уведомлений рисков:', error);
    }
  }

  /**
   * Проверка алертов по ценам
   */
  async checkPriceAlerts(userId: string): Promise<void> {
    try {
      const userAlerts = this.priceAlerts.get(userId) || [];
      
      // Получаем актуальные цены для всех активов с алертами
      const alertSymbols = userAlerts.map(alert => alert.assetSymbol);
      const priceData = await this.marketDataService.getMultiplePrices(alertSymbols);

      for (const alert of userAlerts) {
        if (alert.triggered) continue;

        const currentPriceData = priceData.get(alert.assetSymbol);
        if (!currentPriceData) continue;

        const currentPrice = currentPriceData.price;

        let shouldTrigger = false;

        switch (alert.condition) {
          case 'above':
            shouldTrigger = currentPrice > alert.threshold;
            break;
          case 'below':
            shouldTrigger = currentPrice < alert.threshold;
            break;
          case 'change_percent':
            const changePercent = Math.abs((currentPrice - alert.currentPrice) / alert.currentPrice * 100);
            shouldTrigger = changePercent >= alert.threshold;
            break;
        }

        if (shouldTrigger) {
          alert.triggered = true;

          await this.createNotification(userId, {
            type: 'price_alert',
            title: `Алерт по цене: ${alert.assetSymbol}`,
            message: this.getPriceAlertMessage(alert, currentPrice),
            severity: 'info',
            data: { alert, currentPrice },
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 часа
          });
        }
      }

      // Обновляем алерты
      this.priceAlerts.set(userId, userAlerts);

    } catch (error) {
      console.error('Ошибка проверки алертов по ценам:', error);
    }
  }

  /**
   * Создание уведомления о значительном изменении портфеля
   */
  async checkPortfolioChanges(userId: string): Promise<void> {
    try {
      const portfolio = await this.portfolioService.getPortfolio(userId);
      
      // Проверяем значительные изменения прибыли/убытков
      for (const position of portfolio.positions) {
        if (Math.abs(position.profitLossPercentage) > 10) {
          const isProfit = position.profitLossPercentage > 0;
          
          await this.createNotification(userId, {
            type: 'portfolio_change',
            title: `${isProfit ? 'Прибыль' : 'Убыток'} по позиции: ${position.assetSymbol}`,
            message: `${position.assetSymbol}: ${isProfit ? '+' : ''}${position.profitLossPercentage.toFixed(1)}% (${isProfit ? '+' : ''}${position.profitLoss.toFixed(0)} руб.)`,
            severity: isProfit ? 'success' : 'error',
            data: position,
            expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 часов
          });
        }
      }

    } catch (error) {
      console.error('Ошибка проверки изменений портфеля:', error);
    }
  }

  /**
   * Полная проверка всех уведомлений для пользователя
   */
  async checkAllNotifications(userId: string): Promise<void> {
    await Promise.all([
      this.checkRiskNotifications(userId),
      this.checkPriceAlerts(userId),
      this.checkPortfolioChanges(userId),
    ]);
  }

  /**
   * Генерация сообщения для алерта по цене
   */
  private getPriceAlertMessage(alert: PriceAlert, currentPrice: number): string {
    switch (alert.condition) {
      case 'above':
        return `${alert.assetSymbol} достиг цены ${currentPrice.toFixed(2)}, что выше порога ${alert.threshold.toFixed(2)}`;
      case 'below':
        return `${alert.assetSymbol} достиг цены ${currentPrice.toFixed(2)}, что ниже порога ${alert.threshold.toFixed(2)}`;
      case 'change_percent':
        const changePercent = ((currentPrice - alert.currentPrice) / alert.currentPrice * 100).toFixed(1);
        return `${alert.assetSymbol} изменился на ${changePercent}% с ${alert.currentPrice.toFixed(2)} до ${currentPrice.toFixed(2)}`;
      default:
        return `Алерт по ${alert.assetSymbol} сработал`;
    }
  }

  /**
   * Генерация уникального ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Очистка старых уведомлений
   */
  async cleanupOldNotifications(): Promise<void> {
    const now = new Date();
    
    for (const [userId, notifications] of this.notifications.entries()) {
      const validNotifications = notifications.filter(notification => 
        !notification.expiresAt || notification.expiresAt > now
      );
      this.notifications.set(userId, validNotifications);
    }
  }
}