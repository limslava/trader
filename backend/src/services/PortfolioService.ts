import { MarketDataService } from './MarketDataService';

export interface ITransactionInput {
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

export interface SimpleTransaction {
  _id: string;
  userId: string;
  assetSymbol: string;
  assetType: 'stock' | 'crypto' | 'currency';
  transactionType: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
  commission: number;
  timestamp: Date;
  status: 'completed' | 'pending' | 'cancelled';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioPosition {
  assetSymbol: string;
  assetType: 'stock' | 'crypto' | 'currency';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  positions: PortfolioPosition[];
  cashBalance: number;
}

export class PortfolioService {
  private marketDataService: MarketDataService;

  constructor() {
    this.marketDataService = new MarketDataService();
  }

  /**
   * Получить портфель пользователя
   */
  async getPortfolio(userId: string): Promise<PortfolioSummary> {
    try {
      // Получаем все транзакции пользователя
      const transactions = await this.getUserTransactions(userId);
      
      // Рассчитываем позиции портфеля
      const positions = await this.calculatePortfolioPositions(userId, transactions);
      
      // Получаем текущие цены для расчета стоимости
      const portfolioSummary = await this.calculatePortfolioSummary(positions);
      
      return portfolioSummary;
    } catch (error) {
      console.error('Ошибка при получении портфеля:', error);
      throw new Error('Не удалось получить данные портфеля');
    }
  }

  /**
   * Получить транзакции пользователя
   */
  async getUserTransactions(userId: string): Promise<SimpleTransaction[]> {
    // Используем временное хранилище
    return this.getMockTransactions(userId);
  }

  /**
   * Добавить транзакцию
   */
  async addTransaction(transactionData: ITransactionInput): Promise<SimpleTransaction> {
    try {
      // Рассчитываем общую сумму
      const totalAmount = transactionData.quantity * transactionData.price + (transactionData.commission || 0);

      // Временное хранилище - просто возвращаем объект
      return {
        ...transactionData,
        _id: `mock_${Date.now()}`,
        totalAmount,
        createdAt: new Date(),
        updatedAt: new Date()
      } as SimpleTransaction;
    } catch (error) {
      console.error('Ошибка при добавлении транзакции:', error);
      throw new Error('Не удалось добавить транзакцию');
    }
  }

  /**
   * Рассчитать позиции портфеля
   */
  private async calculatePortfolioPositions(userId: string, transactions: SimpleTransaction[]): Promise<PortfolioPosition[]> {
    const positions: { [key: string]: PortfolioPosition } = {};

    for (const transaction of transactions) {
      const key = `${transaction.assetSymbol}_${transaction.assetType}`;
      
      if (!positions[key]) {
        positions[key] = {
          assetSymbol: transaction.assetSymbol,
          assetType: transaction.assetType,
          quantity: 0,
          averagePrice: 0,
          currentPrice: 0,
          totalCost: 0,
          currentValue: 0,
          profitLoss: 0,
          profitLossPercentage: 0
        };
      }

      const position = positions[key];

      if (transaction.transactionType === 'buy') {
        const newTotalCost = position.totalCost + transaction.totalAmount;
        const newQuantity = position.quantity + transaction.quantity;
        
        position.quantity = newQuantity;
        position.averagePrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
        position.totalCost = newTotalCost;
      } else if (transaction.transactionType === 'sell') {
        position.quantity -= transaction.quantity;
        // При продаже уменьшаем общую стоимость пропорционально
        position.totalCost = position.averagePrice * position.quantity;
      }
    }

    // Получаем текущие цены для активов
    const assetSymbols = Object.keys(positions);
    const symbols = assetSymbols.map(symbol => symbol.split('_')[0]).filter(Boolean) as string[];
    const currentPricesMap = await this.marketDataService.getMultiplePrices(symbols);
    const currentPrices: { [key: string]: number } = {};
    
    for (const [symbol, priceData] of currentPricesMap.entries()) {
      currentPrices[symbol] = priceData.price;
    }

    // Обновляем позиции с текущими ценами
    const result: PortfolioPosition[] = [];
    for (const key in positions) {
      const position = positions[key];
      if (position) {
        const currentPrice = currentPrices[position.assetSymbol] || position.averagePrice;
        
        position.currentPrice = currentPrice;
        position.currentValue = position.quantity * currentPrice;
        position.profitLoss = position.currentValue - position.totalCost;
        position.profitLossPercentage = position.totalCost > 0 ? (position.profitLoss / position.totalCost) * 100 : 0;

        // Добавляем только позиции с ненулевым количеством
        if (position.quantity > 0) {
          result.push(position);
        }
      }
    }

    return result;
  }

  /**
   * Рассчитать сводку портфеля
   */
  private async calculatePortfolioSummary(positions: PortfolioPosition[]): Promise<PortfolioSummary> {
    const totalCost = positions.reduce((sum, position) => sum + position.totalCost, 0);
    const totalValue = positions.reduce((sum, position) => sum + position.currentValue, 0);
    const totalProfitLoss = totalValue - totalCost;
    const totalProfitLossPercentage = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalProfitLoss,
      totalProfitLossPercentage,
      positions,
      cashBalance: 100000 // Стартовый баланс для демо
    };
  }

  /**
   * Получить историю транзакций
   */
  async getTransactionHistory(userId: string, limit: number = 50): Promise<SimpleTransaction[]> {
    return this.getMockTransactions(userId).slice(0, limit);
  }

  /**
   * Моковые транзакции для временного хранилища
   */
  private getMockTransactions(userId: string): SimpleTransaction[] {
    const mockTransactions: SimpleTransaction[] = [
      {
        _id: 'mock_1',
        userId,
        assetSymbol: 'SBER',
        assetType: 'stock',
        transactionType: 'buy',
        quantity: 10,
        price: 250,
        totalAmount: 2500,
        commission: 25,
        timestamp: new Date('2025-10-01'),
        status: 'completed',
        notes: 'Покупка Сбербанка',
        createdAt: new Date('2025-10-01'),
        updatedAt: new Date('2025-10-01')
      },
      {
        _id: 'mock_2',
        userId,
        assetSymbol: 'GAZP',
        assetType: 'stock',
        transactionType: 'buy',
        quantity: 5,
        price: 180,
        totalAmount: 900,
        commission: 9,
        timestamp: new Date('2025-10-05'),
        status: 'completed',
        notes: 'Покупка Газпрома',
        createdAt: new Date('2025-10-05'),
        updatedAt: new Date('2025-10-05')
      },
      {
        _id: 'mock_3',
        userId,
        assetSymbol: 'BTCUSDT',
        assetType: 'crypto',
        transactionType: 'buy',
        quantity: 0.01,
        price: 45000,
        totalAmount: 450,
        commission: 4.5,
        timestamp: new Date('2025-10-10'),
        status: 'completed',
        notes: 'Покупка Bitcoin',
        createdAt: new Date('2025-10-10'),
        updatedAt: new Date('2025-10-10')
      }
    ];

    return mockTransactions;
  }

  /**
   * Получить статистику портфеля
   */
  async getPortfolioStats(userId: string) {
    const portfolio = await this.getPortfolio(userId);
    const transactions = await this.getTransactionHistory(userId);

    return {
      portfolio,
      transactionCount: transactions.length,
      totalTrades: transactions.filter(t => t.status === 'completed').length,
      winningTrades: transactions.filter(t => 
        t.status === 'completed' && 
        ((t.transactionType === 'buy' && t.price < (portfolio.positions.find(p => p.assetSymbol === t.assetSymbol)?.currentPrice || 0)) ||
         (t.transactionType === 'sell' && t.price > (portfolio.positions.find(p => p.assetSymbol === t.assetSymbol)?.averagePrice || 0)))
      ).length
    };
  }
}