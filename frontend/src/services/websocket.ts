import { io, Socket } from 'socket.io-client';
import { pushNotificationService } from './pushNotificationService';

export interface PriceUpdate {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface PriceUpdateMessage {
  timestamp: string;
  prices: PriceUpdate[];
}

export interface RiskAlert {
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
  timestamp: string;
}

export interface RecommendationUpdate {
  symbol: string;
  recommendation: string;
  confidence: number;
  timestamp: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private notificationCooldown = new Map<string, number>();

  // Callbacks для обработки событий
  private onPriceUpdateCallbacks: ((data: PriceUpdateMessage) => void)[] = [];
  private onRiskAlertCallbacks: ((alert: RiskAlert) => void)[] = [];
  private onRecommendationCallbacks: ((recommendation: RecommendationUpdate) => void)[] = [];
  private onConnectionChangeCallbacks: ((connected: boolean) => void)[] = [];

  connect() {
    if (this.socket && this.isConnected) {
      console.log('WebSocket уже подключен');
      return;
    }

    this.socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket подключен к серверу');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionChange(true);
      
      // Автоматически подписываемся на обновления цен
      this.subscribeToPrices();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket отключен:', reason);
      this.isConnected = false;
      this.notifyConnectionChange(false);
      
      if (reason === 'io server disconnect') {
        // Сервер принудительно отключил, пытаемся переподключиться
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket:', error);
      this.isConnected = false;
      this.notifyConnectionChange(false);
      
      this.reconnectAttempts++;
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        setTimeout(() => {
          this.socket?.connect();
        }, 2000 * this.reconnectAttempts);
      }
    });

    // Обработчики пользовательских событий
    this.socket.on('price-update', (data: PriceUpdateMessage) => {
      console.log('📈 Получено обновление цен:', data.prices?.length || 0, 'активов');
      console.log('📊 Данные цен:', data);
      this.onPriceUpdateCallbacks.forEach(callback => callback(data));
    });

    this.socket.on('price-update-single', (data: PriceUpdate) => {
      console.log('📈 Обновление цены для:', data.symbol, data.currentPrice);
      const message: PriceUpdateMessage = {
        timestamp: data.timestamp,
        prices: [data]
      };
      this.onPriceUpdateCallbacks.forEach(callback => callback(message));
    });

    this.socket.on('risk-alert', (alert: RiskAlert) => {
      console.log('⚠️ Получено предупреждение о риске:', alert.message);
      this.onRiskAlertCallbacks.forEach(callback => callback(alert));
      
      // Отправляем push-уведомление для рисковых алертов
      this.sendPushNotification('⚠️ Риск-алерт', alert.message, 'high');
    });

    this.socket.on('new-recommendation', (recommendation: RecommendationUpdate) => {
      console.log('🎯 Новая рекомендация:', recommendation.symbol, recommendation.recommendation);
      this.onRecommendationCallbacks.forEach(callback => callback(recommendation));
      
      // Отправляем push-уведомление для рекомендаций
      const title = `🎯 ${recommendation.symbol}: ${this.getRecommendationText(recommendation.recommendation)}`;
      const body = `Уверенность: ${recommendation.confidence}%`;
      this.sendPushNotification(title, body, 'medium');
    });

    // Обработчик push-уведомлений от сервера
    this.socket.on('push-notification', (data: any) => {
      console.log('📱 Получено push-уведомление от сервера:', data);
      if (data.title && data.message) {
        this.sendPushNotification(data.title, data.message, data.priority || 'medium');
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.notifyConnectionChange(false);
      console.log('🔌 WebSocket отключен');
    }
  }

  subscribeToPrices(symbols?: string[]) {
    if (!this.socket || !this.isConnected) {
      console.warn('WebSocket не подключен, невозможно подписаться на цены');
      return;
    }

    const symbolsToSubscribe = symbols || [
      'SBER', 'GAZP', 'LKOH', 'VTBR', 'ROSN',
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'
    ];

    this.socket.emit('subscribe-prices', symbolsToSubscribe);
    console.log('📊 Подписка на обновления цен для:', symbolsToSubscribe);
  }

  unsubscribeFromPrices() {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('unsubscribe-prices');
    console.log('📊 Отписка от обновлений цен');
  }

  // Методы для регистрации callback'ов
  onPriceUpdate(callback: (data: PriceUpdateMessage) => void) {
    this.onPriceUpdateCallbacks.push(callback);
    return () => {
      const index = this.onPriceUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.onPriceUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onRiskAlert(callback: (alert: RiskAlert) => void) {
    this.onRiskAlertCallbacks.push(callback);
    return () => {
      const index = this.onRiskAlertCallbacks.indexOf(callback);
      if (index > -1) {
        this.onRiskAlertCallbacks.splice(index, 1);
      }
    };
  }

  onRecommendation(callback: (recommendation: RecommendationUpdate) => void) {
    this.onRecommendationCallbacks.push(callback);
    return () => {
      const index = this.onRecommendationCallbacks.indexOf(callback);
      if (index > -1) {
        this.onRecommendationCallbacks.splice(index, 1);
      }
    };
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.onConnectionChangeCallbacks.push(callback);
    return () => {
      const index = this.onConnectionChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onConnectionChangeCallbacks.splice(index, 1);
      }
    };
  }

  private notifyConnectionChange(connected: boolean) {
    this.onConnectionChangeCallbacks.forEach(callback => callback(connected));
  }

  // Вспомогательные методы
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Запрос текущих цен
  async getCurrentPrices(symbols: string[]): Promise<PriceUpdate[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('WebSocket не подключен'));
        return;
      }

      this.socket.emit('get-prices', symbols, (response: any) => {
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Не удалось получить цены'));
        }
      });

      // Таймаут
      setTimeout(() => {
        reject(new Error('Таймаут запроса цен'));
      }, 5000);
    });
  }

  private sendPushNotification(title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    const notificationKey = `${title}_${message}`;
    const now = Date.now();
    const lastSent = this.notificationCooldown.get(notificationKey);
    
    // Защита от дублирования: не показываем одинаковые уведомления чаще чем раз в 30 секунд
    if (!lastSent || now - lastSent > 30000) {
      console.log('📱 Отправка push-уведомления:', title);
      
      pushNotificationService.sendNotification({
        title,
        body: message,
        tag: `ws_${Date.now()}`,
        requireInteraction: priority === 'high'
      });
      
      // Сохраняем время отправки
      this.notificationCooldown.set(notificationKey, now);
      
      // Очищаем старые записи каждые 5 минут
      setTimeout(() => {
        this.notificationCooldown.delete(notificationKey);
      }, 300000);
    } else {
      console.log('📱 Пропущено дублирующее уведомление:', title);
    }
  }

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
}

// Создаем singleton экземпляр
const webSocketService = new WebSocketService();

export default webSocketService;