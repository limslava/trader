import axios from 'axios';

export interface BrokerAccount {
  id: string;
  brokerName: string;
  accountNumber: string;
  balance: number;
  currency: string;
  status: 'active' | 'inactive' | 'pending';
}

export interface BrokerOrder {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'executed' | 'cancelled' | 'rejected';
  timestamp: Date;
  brokerOrderId?: string;
}

export interface BrokerPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface BrokerTrade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: Date;
  commission: number;
}

// Интерфейсы для популярных российских брокеров
interface TinkoffBrokerConfig {
  apiKey: string;
  accountId: string;
  sandbox: boolean;
}

interface SberInvestBrokerConfig {
  token: string;
  accountId: string;
}

interface VTBTraderConfig {
  login: string;
  password: string;
  accountId: string;
}

export class BrokerIntegrationService {
  private tinkoffConfig?: TinkoffBrokerConfig;
  private sberInvestConfig?: SberInvestBrokerConfig;
  private vtbConfig?: VTBTraderConfig;

  constructor() {
    // В реальном приложении конфигурация будет загружаться из базы данных
    this.loadBrokerConfigurations();
  }

  private loadBrokerConfigurations() {
    // Загрузка конфигураций брокеров (в демо-режиме используем мок-данные)
    this.tinkoffConfig = {
      apiKey: process.env.TINKOFF_API_KEY || 'demo_key',
      accountId: process.env.TINKOFF_ACCOUNT_ID || 'demo_account',
      sandbox: true
    };

    this.sberInvestConfig = {
      token: process.env.SBER_INVEST_TOKEN || 'demo_token',
      accountId: process.env.SBER_INVEST_ACCOUNT_ID || 'demo_account'
    };

    this.vtbConfig = {
      login: process.env.VTB_LOGIN || 'demo_login',
      password: process.env.VTB_PASSWORD || 'demo_password',
      accountId: process.env.VTB_ACCOUNT_ID || 'demo_account'
    };
  }

  /**
   * Получение списка подключенных брокерских счетов
   */
  async getConnectedAccounts(): Promise<BrokerAccount[]> {
    const accounts: BrokerAccount[] = [];

    // Тинькофф Инвестиции
    if (this.tinkoffConfig) {
      accounts.push({
        id: 'tinkoff_1',
        brokerName: 'Тинькофф Инвестиции',
        accountNumber: this.tinkoffConfig.accountId,
        balance: 150000,
        currency: 'RUB',
        status: 'active'
      });
    }

    // Сбербанк Инвестор
    if (this.sberInvestConfig) {
      accounts.push({
        id: 'sber_1',
        brokerName: 'Сбербанк Инвестор',
        accountNumber: this.sberInvestConfig.accountId,
        balance: 200000,
        currency: 'RUB',
        status: 'active'
      });
    }

    // ВТБ Мои Инвестиции
    if (this.vtbConfig) {
      accounts.push({
        id: 'vtb_1',
        brokerName: 'ВТБ Мои Инвестиции',
        accountNumber: this.vtbConfig.accountId,
        balance: 100000,
        currency: 'RUB',
        status: 'active'
      });
    }

    return accounts;
  }

  /**
   * Получение портфеля позиций от брокера
   */
  async getBrokerPositions(brokerAccountId: string): Promise<BrokerPosition[]> {
    // В реальном приложении здесь будет API-запрос к брокеру
    // Для демо возвращаем мок-данные

    const mockPositions: Record<string, BrokerPosition[]> = {
      'tinkoff_1': [
        {
          symbol: 'SBER',
          quantity: 100,
          averagePrice: 250,
          currentPrice: 280,
          profitLoss: 3000,
          profitLossPercent: 12.0
        },
        {
          symbol: 'GAZP',
          quantity: 50,
          averagePrice: 160,
          currentPrice: 155,
          profitLoss: -250,
          profitLossPercent: -3.1
        },
        {
          symbol: 'LKOH',
          quantity: 25,
          averagePrice: 6500,
          currentPrice: 6800,
          profitLoss: 7500,
          profitLossPercent: 4.6
        }
      ],
      'sber_1': [
        {
          symbol: 'SBER',
          quantity: 200,
          averagePrice: 240,
          currentPrice: 280,
          profitLoss: 8000,
          profitLossPercent: 16.7
        },
        {
          symbol: 'VTBR',
          quantity: 1000,
          averagePrice: 0.025,
          currentPrice: 0.027,
          profitLoss: 2000,
          profitLossPercent: 8.0
        }
      ],
      'vtb_1': [
        {
          symbol: 'GAZP',
          quantity: 100,
          averagePrice: 158,
          currentPrice: 155,
          profitLoss: -300,
          profitLossPercent: -1.9
        },
        {
          symbol: 'ROSN',
          quantity: 30,
          averagePrice: 450,
          currentPrice: 480,
          profitLoss: 900,
          profitLossPercent: 6.7
        }
      ]
    };

    return mockPositions[brokerAccountId] || [];
  }

  /**
   * Размещение заявки через брокера
   */
  async placeOrder(
    brokerAccountId: string,
    symbol: string,
    type: 'buy' | 'sell',
    quantity: number,
    price?: number
  ): Promise<BrokerOrder> {
    // В реальном приложении здесь будет API-запрос к брокеру
    // Для демо создаем мок-заявку

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentPrice = this.getMockPrice(symbol);

    const order: BrokerOrder = {
      id: orderId,
      symbol,
      type,
      quantity,
      price: price || currentPrice,
      status: 'pending',
      timestamp: new Date(),
      brokerOrderId: `${brokerAccountId}_${orderId}`
    };

    // Имитация исполнения заявки через 2 секунды
    setTimeout(() => {
      this.simulateOrderExecution(order);
    }, 2000);

    console.log(`Заявка размещена через брокера ${brokerAccountId}:`, {
      symbol,
      type,
      quantity,
      price: order.price
    });

    return order;
  }

  /**
   * Отмена заявки
   */
  async cancelOrder(brokerAccountId: string, orderId: string): Promise<boolean> {
    // В реальном приложении здесь будет API-запрос к брокеру
    console.log(`Заявка отменена: ${orderId} через брокера ${brokerAccountId}`);
    return true;
  }

  /**
   * Получение истории сделок
   */
  async getTradeHistory(brokerAccountId: string, days: number = 30): Promise<BrokerTrade[]> {
    // В реальном приложении здесь будет API-запрос к брокеру
    // Для демо возвращаем мок-данные

    const mockTrades: Record<string, BrokerTrade[]> = {
      'tinkoff_1': [
        {
          id: 'trade_1',
          symbol: 'SBER',
          type: 'buy',
          quantity: 50,
          price: 250,
          timestamp: new Date(Date.now() - 86400000), // 1 день назад
          commission: 25
        },
        {
          id: 'trade_2',
          symbol: 'GAZP',
          type: 'sell',
          quantity: 25,
          price: 162,
          timestamp: new Date(Date.now() - 172800000), // 2 дня назад
          commission: 16
        }
      ],
      'sber_1': [
        {
          id: 'trade_3',
          symbol: 'VTBR',
          type: 'buy',
          quantity: 500,
          price: 0.025,
          timestamp: new Date(Date.now() - 259200000), // 3 дня назад
          commission: 12.5
        }
      ]
    };

    return mockTrades[brokerAccountId] || [];
  }

  /**
   * Получение доступных средств для торговли
   */
  async getAvailableFunds(brokerAccountId: string): Promise<number> {
    // В реальном приложении здесь будет API-запрос к брокеру
    const mockFunds: Record<string, number> = {
      'tinkoff_1': 50000,
      'sber_1': 75000,
      'vtb_1': 30000
    };

    return mockFunds[brokerAccountId] || 0;
  }

  /**
   * Проверка возможности размещения заявки
   */
  async validateOrder(
    brokerAccountId: string,
    symbol: string,
    type: 'buy' | 'sell',
    quantity: number,
    price?: number
  ): Promise<{ valid: boolean; message?: string; availableFunds?: number }> {
    const availableFunds = await this.getAvailableFunds(brokerAccountId);
    const currentPrice = price || this.getMockPrice(symbol);
    const totalCost = quantity * currentPrice;

    if (type === 'buy' && totalCost > availableFunds) {
      return {
        valid: false,
        message: `Недостаточно средств. Доступно: ${availableFunds} RUB, требуется: ${totalCost} RUB`,
        availableFunds
      };
    }

    // Проверка минимального лота (для российских акций обычно 1 лот = 1 акция)
    if (quantity < 1) {
      return {
        valid: false,
        message: 'Минимальный лот: 1 акция'
      };
    }

    return {
      valid: true,
      availableFunds
    };
  }

  private getMockPrice(symbol: string): number {
    const mockPrices: Record<string, number> = {
      'SBER': 280,
      'GAZP': 155,
      'LKOH': 6800,
      'VTBR': 0.027,
      'ROSN': 480,
      'GMKN': 22000,
      'NLMK': 150,
      'PLZL': 12000,
      'TATN': 380,
      'MGNT': 5500
    };

    return mockPrices[symbol] || 100;
  }

  private simulateOrderExecution(order: BrokerOrder) {
    // Имитация исполнения заявки
    order.status = 'executed';
    console.log(`Заявка исполнена: ${order.id}`, {
      symbol: order.symbol,
      type: order.type,
      quantity: order.quantity,
      price: order.price
    });

    // Здесь можно добавить логику обновления портфеля и отправки уведомлений
  }

  /**
   * Получение информации о комиссиях брокера
   */
  getBrokerCommissions(brokerAccountId: string) {
    const commissions = {
      'tinkoff_1': {
        stockCommission: 0.003, // 0.3%
        minCommission: 0,
        currency: 'RUB'
      },
      'sber_1': {
        stockCommission: 0.0035, // 0.35%
        minCommission: 35,
        currency: 'RUB'
      },
      'vtb_1': {
        stockCommission: 0.004, // 0.4%
        minCommission: 40,
        currency: 'RUB'
      }
    };

    return commissions[brokerAccountId as keyof typeof commissions] || {
      stockCommission: 0.003,
      minCommission: 0,
      currency: 'RUB'
    };
  }
}

export default BrokerIntegrationService;