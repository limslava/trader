import api from './api';

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

export interface Transaction {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalAmount: number;
  fee: number;
  timestamp: Date;
  status: 'completed' | 'pending' | 'cancelled';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransactionInput {
  assetSymbol: string;
  assetType: 'stock' | 'crypto' | 'currency';
  transactionType: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission?: number;
  notes?: string;
}

export interface PortfolioStats {
  portfolio: PortfolioSummary;
  transactionCount: number;
  totalTrades: number;
  winningTrades: number;
}

/**
 * API для работы с портфелем
 */
export const portfolioApi = {
  /**
   * Получить портфель пользователя
   */
  async getPortfolio(): Promise<PortfolioSummary> {
    const response = await api.get('/portfolio');
    return response.data.data;
  },

  /**
   * Получить историю транзакций
   */
  async getTransactions(limit?: number): Promise<Transaction[]> {
    const params = limit ? { limit } : {};
    const response = await api.get('/portfolio/transactions', { params });
    return response.data.data;
  },

  /**
   * Добавить транзакцию
   */
  async addTransaction(transaction: TransactionInput): Promise<Transaction> {
    const response = await api.post('/portfolio/transactions', transaction);
    return response.data.data;
  },

  /**
   * Получить статистику портфеля
   */
  async getStats(): Promise<PortfolioStats> {
    const response = await api.get('/portfolio/stats');
    return response.data.data;
  },

  /**
   * Удалить транзакцию
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    await api.delete(`/portfolio/transactions/${transactionId}`);
  }
};