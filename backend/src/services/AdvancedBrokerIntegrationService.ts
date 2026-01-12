import { MemoryCacheService } from './MemoryCacheService';

export interface BrokerAccount {
  id: string;
  broker: string;
  accountNumber: string;
  balance: number;
  currency: string;
  available: number;
  blocked: number;
}

export interface BrokerOrder {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
  createdAt: Date;
  executedAt?: Date;
}

export interface BrokerPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export class AdvancedBrokerIntegrationService {
  private cacheService: MemoryCacheService;

  constructor() {
    this.cacheService = new MemoryCacheService();
  }

  // Интеграция с Тинькофф Инвестиции
  async connectTinkoff(apiKey: string, accountId?: string): Promise<BrokerAccount[]> {
    const cacheKey = `tinkoff_accounts_${apiKey.substring(0, 8)}`;
    
    try {
      // В реальном приложении здесь будет вызов API Тинькофф
      // Пока используем мок-данные для демонстрации
      
      const accounts: BrokerAccount[] = [
        {
          id: 'tinkoff_1',
          broker: 'TINKOFF',
          accountNumber: 'T1234567890',
          balance: 150000,
          currency: 'RUB',
          available: 145000,
          blocked: 5000
        },
        {
          id: 'tinkoff_2', 
          broker: 'TINKOFF',
          accountNumber: 'T0987654321',
          balance: 75000,
          currency: 'USD',
          available: 72000,
          blocked: 3000
        }
      ];

      // Фильтруем по accountId если указан
      const filteredAccounts = accountId 
        ? accounts.filter(acc => acc.id === accountId)
        : accounts;

      // Сохраняем в кэш на 5 минут
      this.cacheService.set(cacheKey, filteredAccounts, { ttl: 300 });
      
      console.log(`✅ Успешно подключено к Тинькофф: ${filteredAccounts.length} счетов`);
      return filteredAccounts;

    } catch (error) {
      console.error('❌ Ошибка подключения к Тинькофф:', error);
      throw new Error('Не удалось подключиться к брокеру Тинькофф');
    }
  }

  // Интеграция с ВТБ Инвестиции
  async connectVTB(apiKey: string, accountId?: string): Promise<BrokerAccount[]> {
    const cacheKey = `vtb_accounts_${apiKey.substring(0, 8)}`;
    
    try {
      const accounts: BrokerAccount[] = [
        {
          id: 'vtb_1',
          broker: 'VTB',
          accountNumber: 'V123456789',
          balance: 200000,
          currency: 'RUB',
          available: 195000,
          blocked: 5000
        }
      ];

      const filteredAccounts = accountId 
        ? accounts.filter(acc => acc.id === accountId)
        : accounts;

      this.cacheService.set(cacheKey, filteredAccounts, { ttl: 300 });
      
      console.log(`✅ Успешно подключено к ВТБ: ${filteredAccounts.length} счетов`);
      return filteredAccounts;

    } catch (error) {
      console.error('❌ Ошибка подключения к ВТБ:', error);
      throw new Error('Не удалось подключиться к брокеру ВТБ');
    }
  }

  // Интеграция со Сбербанк Инвестор
  async connectSber(apiKey: string, accountId?: string): Promise<BrokerAccount[]> {
    const cacheKey = `sber_accounts_${apiKey.substring(0, 8)}`;
    
    try {
      const accounts: BrokerAccount[] = [
        {
          id: 'sber_1',
          broker: 'SBER',
          accountNumber: 'S123456789',
          balance: 180000,
          currency: 'RUB',
          available: 175000,
          blocked: 5000
        },
        {
          id: 'sber_2',
          broker: 'SBER',
          accountNumber: 'S987654321', 
          balance: 50000,
          currency: 'EUR',
          available: 48000,
          blocked: 2000
        }
      ];

      const filteredAccounts = accountId 
        ? accounts.filter(acc => acc.id === accountId)
        : accounts;

      this.cacheService.set(cacheKey, filteredAccounts, { ttl: 300 });
      
      console.log(`✅ Успешно подключено к Сбербанк: ${filteredAccounts.length} счетов`);
      return filteredAccounts;

    } catch (error) {
      console.error('❌ Ошибка подключения к Сбербанк:', error);
      throw new Error('Не удалось подключиться к брокеру Сбербанк');
    }
  }

  // Размещение ордера через брокера
  async placeOrder(
    broker: string,
    accountId: string,
    symbol: string,
    type: 'BUY' | 'SELL',
    quantity: number,
    price?: number
  ): Promise<BrokerOrder> {
    const cacheKey = `order_${broker}_${accountId}_${Date.now()}`;
    
    try {
      // В реальном приложении здесь будет вызов API брокера
      const order: BrokerOrder = {
        id: `order_${Date.now()}`,
        symbol,
        type,
        quantity,
        price: price || this.getCurrentPrice(symbol),
        status: 'EXECUTED',
        createdAt: new Date(),
        executedAt: new Date()
      };

      // Сохраняем в кэш на 1 час
      this.cacheService.set(cacheKey, order, { ttl: 3600 });
      
      console.log(`✅ Ордер размещен через ${broker}: ${type} ${quantity} ${symbol}`);
      return order;

    } catch (error) {
      console.error(`❌ Ошибка размещения ордера через ${broker}:`, error);
      throw new Error(`Не удалось разместить ордер через брокера ${broker}`);
    }
  }

  // Получение позиций по счету
  async getPositions(broker: string, accountId: string): Promise<BrokerPosition[]> {
    const cacheKey = `positions_${broker}_${accountId}`;
    
    try {
      // Проверяем кэш
      const cached = await this.cacheService.get<BrokerPosition[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Мок-данные позиций
      const positions: BrokerPosition[] = [
        {
          symbol: 'SBER',
          quantity: 100,
          averagePrice: 275.50,
          currentPrice: 280.50,
          pnl: 500,
          pnlPercent: 1.82
        },
        {
          symbol: 'GAZP',
          quantity: 200,
          averagePrice: 160.25,
          currentPrice: 162.30,
          pnl: 410,
          pnlPercent: 1.28
        },
        {
          symbol: 'LKOH',
          quantity: 10,
          averagePrice: 7450.00,
          currentPrice: 7480.25,
          pnl: 302.5,
          pnlPercent: 0.41
        }
      ];

      // Сохраняем в кэш на 2 минуты
      this.cacheService.set(cacheKey, positions, { ttl: 120 });
      
      return positions;

    } catch (error) {
      console.error(`❌ Ошибка получения позиций от ${broker}:`, error);
      return [];
    }
  }

  // Получение истории ордеров
  async getOrderHistory(broker: string, accountId: string, limit: number = 50): Promise<BrokerOrder[]> {
    const cacheKey = `order_history_${broker}_${accountId}_${limit}`;
    
    try {
      const cached = await this.cacheService.get<BrokerOrder[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Мок-данные истории ордеров
      const orders: BrokerOrder[] = [
        {
          id: 'order_1',
          symbol: 'SBER',
          type: 'BUY',
          quantity: 50,
          price: 275.50,
          status: 'EXECUTED',
          createdAt: new Date(Date.now() - 86400000), // 1 день назад
          executedAt: new Date(Date.now() - 86300000)
        },
        {
          id: 'order_2',
          symbol: 'GAZP',
          type: 'BUY', 
          quantity: 100,
          price: 160.25,
          status: 'EXECUTED',
          createdAt: new Date(Date.now() - 172800000), // 2 дня назад
          executedAt: new Date(Date.now() - 171800000)
        },
        {
          id: 'order_3',
          symbol: 'LKOH',
          type: 'BUY',
          quantity: 5,
          price: 7450.00,
          status: 'EXECUTED',
          createdAt: new Date(Date.now() - 259200000), // 3 дня назад
          executedAt: new Date(Date.now() - 258200000)
        }
      ];

      this.cacheService.set(cacheKey, orders.slice(0, limit), { ttl: 300 });
      
      return orders.slice(0, limit);

    } catch (error) {
      console.error(`❌ Ошибка получения истории ордеров от ${broker}:`, error);
      return [];
    }
  }

  // Автоматическое исполнение рекомендаций
  async executeRecommendation(
    broker: string,
    accountId: string,
    symbol: string,
    recommendation: 'BUY' | 'SELL' | 'HOLD',
    confidence: number,
    currentPrice: number,
    portfolioValue: number
  ): Promise<BrokerOrder | null> {
    
    if (recommendation === 'HOLD' || confidence < 60) {
      console.log(`⏸️  Рекомендация HOLD или низкая уверенность (${confidence}%) - ордер не размещается`);
      return null;
    }

    try {
      // Расчет размера позиции на основе риск-менеджмента
      const positionSize = this.calculatePositionSize(portfolioValue, confidence, recommendation);
      
      if (positionSize.quantity <= 0) {
        console.log('⚠️  Размер позиции слишком мал для размещения ордера');
        return null;
      }

      // Размещение ордера
      const order = await this.placeOrder(
        broker,
        accountId,
        symbol,
        recommendation,
        positionSize.quantity,
        currentPrice
      );

      console.log(`🎯 Автоматически исполнена рекомендация: ${recommendation} ${positionSize.quantity} ${symbol}`);
      return order;

    } catch (error) {
      console.error('❌ Ошибка автоматического исполнения рекомендации:', error);
      return null;
    }
  }

  private calculatePositionSize(
    portfolioValue: number,
    confidence: number,
    recommendation: string
  ): { quantity: number; value: number } {
    
    // Базовый риск на сделку: 2% от портфеля
    let riskPercentage = 0.02;
    
    // Корректировка риска на основе уверенности
    if (confidence >= 80) {
      riskPercentage = 0.03; // 3% для высокоуверенных сигналов
    } else if (confidence >= 70) {
      riskPercentage = 0.025; // 2.5% для уверенных сигналов
    } else if (confidence < 60) {
      riskPercentage = 0.01; // 1% для слабых сигналов
    }

    // Дополнительная корректировка для SELL рекомендаций (меньший риск)
    if (recommendation === 'SELL') {
      riskPercentage *= 0.7;
    }

    const positionValue = portfolioValue * riskPercentage;
    
    // Для демонстрации используем базовую цену
    const basePrice = this.getCurrentPrice('SBER'); // Можно адаптировать под конкретный символ
    const quantity = Math.floor(positionValue / basePrice);

    return {
      quantity,
      value: positionValue
    };
  }

  private getCurrentPrice(symbol: string): number {
    // Базовые цены для расчета
    const prices: { [key: string]: number } = {
      'SBER': 280.50,
      'GAZP': 162.30,
      'LKOH': 7480.25,
      'VTBR': 0.0248,
      'ROSN': 548.75,
      'BTCUSDT': 35420.50,
      'ETHUSDT': 1985.30
    };
    
    return prices[symbol] || 100;
  }

  // Получение доступных брокеров
  getAvailableBrokers(): Array<{ id: string; name: string; supported: boolean }> {
    return [
      { id: 'TINKOFF', name: 'Тинькофф Инвестиции', supported: true },
      { id: 'VTB', name: 'ВТБ Инвестиции', supported: true },
      { id: 'SBER', name: 'Сбербанк Инвестор', supported: true },
      { id: 'ALFA', name: 'Альфа-Банк', supported: false },
      { id: 'OPEN', name: 'Открытие Брокер', supported: false },
      { id: 'BINANCE', name: 'Binance', supported: true }
    ];
  }
}