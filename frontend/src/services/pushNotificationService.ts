import { useAuthStore } from '../stores/authStore';

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

class PushNotificationService {
  private permission: NotificationPermission = 'default';
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.permission = Notification.permission;
  }

  /**
   * Запрос разрешения на push-уведомления
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Push-уведомления не поддерживаются в этом браузере');
      return false;
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission === 'granted';
    } catch (error) {
      console.error('Ошибка запроса разрешения на уведомления:', error);
      return false;
    }
  }

  /**
   * Проверка разрешения на уведомления
   */
  hasPermission(): boolean {
    return this.permission === 'granted';
  }

  /**
   * Отправка push-уведомления
   */
  async sendNotification(data: PushNotificationData): Promise<void> {
    if (!this.isSupported || !this.hasPermission()) {
      console.warn('Push-уведомления не разрешены или не поддерживаются');
      return;
    }

    try {
      const options: NotificationOptions = {
        body: data.body,
        icon: data.icon || '/favicon.svg',
        badge: data.badge || '/favicon.svg',
        tag: data.tag,
        data: data.data,
        requireInteraction: data.requireInteraction || false,
        // actions: data.actions, // Убрано из-за проблем с TypeScript
      };

      const notification = new Notification(data.title, options);

      // Обработчик клика по уведомлению
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Обработка действий уведомления
        if (data.data?.action) {
          this.handleNotificationAction(data.data.action, data.data.payload);
        }
      };

      // Автоматическое закрытие через 10 секунд
      setTimeout(() => {
        notification.close();
      }, 10000);

    } catch (error) {
      console.error('Ошибка отправки push-уведомления:', error);
    }
  }

  /**
   * Обработка действий уведомления
   */
  private handleNotificationAction(action: string, payload: any): void {
    const { user } = useAuthStore.getState();
    
    switch (action) {
      case 'open_asset':
        if (payload?.symbol) {
          window.open(`/asset-analysis/${payload.symbol}`, '_blank');
        }
        break;
      
      case 'open_portfolio':
        window.location.href = '/portfolio';
        break;
      
      case 'open_risk':
        window.location.href = '/risk';
        break;
      
      case 'open_analysis':
        window.location.href = '/analysis';
        break;
      
      default:
        console.log('Неизвестное действие уведомления:', action);
    }
  }

  /**
   * Отправка уведомления о значительном изменении цены
   */
  async sendPriceAlertNotification(symbol: string, currentPrice: number, changePercent: number, recommendation?: string): Promise<void> {
    const isPositive = changePercent >= 0;
    const title = `${symbol}: ${isPositive ? '📈' : '📉'} ${Math.abs(changePercent).toFixed(1)}%`;
    const body = `Текущая цена: ${currentPrice.toFixed(2)} ${recommendation ? `(${this.getRecommendationText(recommendation)})` : ''}`;

    await this.sendNotification({
      title,
      body,
      tag: `price_alert_${symbol}`,
      data: {
        action: 'open_asset',
        payload: { symbol }
      },
      // actions: [
      //   {
      //     action: 'open_asset',
      //     title: 'Открыть график'
      //   },
      //   {
      //     action: 'open_analysis',
      //     title: 'Анализ'
      //   }
      // ]
    });
  }

  /**
   * Отправка уведомления о риске
   */
  async sendRiskNotification(title: string, message: string, severity: 'low' | 'medium' | 'high'): Promise<void> {
    const icons = {
      low: '🟢',
      medium: '🟡', 
      high: '🔴'
    };

    await this.sendNotification({
      title: `${icons[severity]} ${title}`,
      body: message,
      tag: `risk_alert_${Date.now()}`,
      data: {
        action: 'open_risk',
        payload: {}
      },
      requireInteraction: severity === 'high',
      // actions: [
      //   {
      //     action: 'open_risk',
      //     title: 'Управление рисками'
      //   },
      //   {
      //     action: 'open_portfolio',
      //     title: 'Портфель'
      //   }
      // ]
    });
  }

  /**
   * Отправка уведомления о рекомендации
   */
  async sendRecommendationNotification(symbol: string, recommendation: string, confidence: number): Promise<void> {
    const recommendationText = this.getRecommendationText(recommendation);
    const title = `🎯 ${symbol}: ${recommendationText}`;
    const body = `Уверенность: ${confidence}%`;

    await this.sendNotification({
      title,
      body,
      tag: `recommendation_${symbol}`,
      data: {
        action: 'open_asset',
        payload: { symbol }
      },
      // actions: [
      //   {
      //     action: 'open_asset',
      //     title: 'Открыть график'
      //   },
      //   {
      //     action: 'open_analysis',
      //     title: 'Детальный анализ'
      //   }
      // ]
    });
  }

  /**
   * Отправка уведомления о портфеле
   */
  async sendPortfolioNotification(title: string, message: string, isProfit: boolean): Promise<void> {
    const icon = isProfit ? '💰' : '📉';

    await this.sendNotification({
      title: `${icon} ${title}`,
      body: message,
      tag: `portfolio_update_${Date.now()}`,
      data: {
        action: 'open_portfolio',
        payload: {}
      },
      actions: [
        {
          action: 'open_portfolio',
          title: 'Открыть портфель'
        }
      ]
    });
  }

  /**
   * Получение текста рекомендации
   */
  private getRecommendationText(recommendation: string): string {
    const texts: { [key: string]: string } = {
      'STRONG_BUY': 'СИЛЬНО ПОКУПАТЬ',
      'BUY': 'ПОКУПАТЬ',
      'HOLD': 'ДЕРЖАТЬ',
      'SELL': 'ПРОДАВАТЬ',
      'STRONG_SELL': 'СИЛЬНО ПРОДАВАТЬ'
    };

    return texts[recommendation] || recommendation;
  }

  /**
   * Инициализация сервиса push-уведомлений
   */
  async initialize(): Promise<void> {
    if (!this.isSupported) {
      return;
    }

    // Автоматически запрашиваем разрешение при инициализации
    if (this.permission === 'default') {
      await this.requestPermission();
    }

    // Периодическая проверка разрешений
    setInterval(() => {
      this.permission = Notification.permission;
    }, 60000); // Каждую минуту
  }
}

// Создаем глобальный экземпляр сервиса
export const pushNotificationService = new PushNotificationService();

// Автоматическая инициализация при загрузке модуля
if (typeof window !== 'undefined') {
  pushNotificationService.initialize();
}

export default pushNotificationService;