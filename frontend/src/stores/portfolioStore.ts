import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { portfolioApi, PortfolioSummary, Transaction, TransactionInput, PortfolioStats } from '../services/portfolioApi';

interface PortfolioState {
  // Состояние
  portfolio: PortfolioSummary | null;
  transactions: Transaction[];
  stats: PortfolioStats | null;
  isLoading: boolean;
  error: string | null;

  // Действия
  loadPortfolio: () => Promise<void>;
  loadTransactions: (limit?: number) => Promise<void>;
  loadStats: () => Promise<void>;
  addTransaction: (transaction: TransactionInput) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      // Начальное состояние
      portfolio: null,
      transactions: [],
      stats: null,
      isLoading: false,
      error: null,

      // Загрузить портфель
      loadPortfolio: async () => {
        set({ isLoading: true, error: null });
        try {
          const portfolio = await portfolioApi.getPortfolio();
          set({ portfolio, isLoading: false });
        } catch (error: any) {
          console.error('Ошибка загрузки портфеля:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось загрузить портфель',
            isLoading: false 
          });
        }
      },

      // Загрузить историю транзакций
      loadTransactions: async (limit = 50) => {
        set({ isLoading: true, error: null });
        try {
          const transactions = await portfolioApi.getTransactions(limit);
          set({ transactions, isLoading: false });
        } catch (error: any) {
          console.error('Ошибка загрузки транзакций:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось загрузить историю транзакций',
            isLoading: false 
          });
        }
      },

      // Загрузить статистику
      loadStats: async () => {
        set({ isLoading: true, error: null });
        try {
          const stats = await portfolioApi.getStats();
          set({ stats, isLoading: false });
        } catch (error: any) {
          console.error('Ошибка загрузки статистики:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось загрузить статистику',
            isLoading: false 
          });
        }
      },

      // Добавить транзакцию
      addTransaction: async (transaction: TransactionInput) => {
        set({ isLoading: true, error: null });
        try {
          const newTransaction = await portfolioApi.addTransaction(transaction);
          const { transactions } = get();
          
          // Обновляем список транзакций
          set({ 
            transactions: [newTransaction, ...transactions],
            isLoading: false 
          });

          // Перезагружаем портфель для обновления позиций
          await get().loadPortfolio();
          await get().loadStats();

        } catch (error: any) {
          console.error('Ошибка добавления транзакции:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось добавить транзакцию',
            isLoading: false 
          });
        }
      },

      // Удалить транзакцию
      deleteTransaction: async (transactionId: string) => {
        set({ isLoading: true, error: null });
        try {
          await portfolioApi.deleteTransaction(transactionId);
          const { transactions } = get();
          
          // Удаляем транзакцию из списка
          set({ 
            transactions: transactions.filter(t => t.id !== transactionId),
            isLoading: false 
          });

          // Перезагружаем портфель для обновления позиций
          await get().loadPortfolio();
          await get().loadStats();

        } catch (error: any) {
          console.error('Ошибка удаления транзакции:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось удалить транзакцию',
            isLoading: false 
          });
        }
      },

      // Очистить ошибку
      clearError: () => set({ error: null }),

      // Сбросить состояние
      reset: () => set({
        portfolio: null,
        transactions: [],
        stats: null,
        isLoading: false,
        error: null
      })
    }),
    {
      name: 'portfolio-storage',
      partialize: (state) => ({
        portfolio: state.portfolio,
        transactions: state.transactions,
        stats: state.stats
      })
    }
  )
);

// Хук для удобного использования
export const usePortfolio = () => {
  const {
    portfolio,
    transactions,
    stats,
    isLoading,
    error,
    loadPortfolio,
    loadTransactions,
    loadStats,
    addTransaction,
    deleteTransaction,
    clearError,
    reset
  } = usePortfolioStore();

  return {
    portfolio,
    transactions,
    stats,
    isLoading,
    error,
    loadPortfolio,
    loadTransactions,
    loadStats,
    addTransaction,
    deleteTransaction,
    clearError,
    reset
  };
};
