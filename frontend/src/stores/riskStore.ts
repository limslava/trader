import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { riskApi, RiskAssessment, RiskStatistics, StopLossRecommendation, TradeRiskCheck, MaxPositionSize } from '../services/riskApi';

interface RiskState {
  // Данные
  riskAssessment: RiskAssessment | null;
  riskStatistics: RiskStatistics | null;
  stopLossRecommendations: StopLossRecommendation[];
  maxPositionSize: MaxPositionSize | null;
  tradeRiskCheck: TradeRiskCheck | null;
  
  // Состояние загрузки
  loading: boolean;
  error: string | null;
  
  // Действия
  loadRiskAssessment: () => Promise<void>;
  loadRiskStatistics: () => Promise<void>;
  loadStopLossRecommendations: () => Promise<void>;
  loadMaxPositionSize: (riskTolerance?: 'low' | 'medium' | 'high') => Promise<void>;
  checkTradeRisk: (data: {
    assetSymbol: string;
    assetType: 'stock' | 'crypto' | 'currency';
    quantity: number;
    price: number;
    transactionType: 'buy' | 'sell';
  }) => Promise<void>;
  
  // Очистка ошибок
  clearError: () => void;
}

export const useRiskStore = create<RiskState>()(
  persist(
    (set, get) => ({
      // Начальное состояние
      riskAssessment: null,
      riskStatistics: null,
      stopLossRecommendations: [],
      maxPositionSize: null,
      tradeRiskCheck: null,
      loading: false,
      error: null,

      // Загрузка оценки рисков
      loadRiskAssessment: async () => {
        set({ loading: true, error: null });
        try {
          const assessment = await riskApi.getRiskAssessment();
          set({ riskAssessment: assessment, loading: false });
        } catch (error: any) {
          console.error('Ошибка загрузки оценки рисков:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось загрузить оценку рисков',
            loading: false 
          });
        }
      },

      // Загрузка статистики рисков
      loadRiskStatistics: async () => {
        set({ loading: true, error: null });
        try {
          const statistics = await riskApi.getRiskStatistics();
          set({ riskStatistics: statistics, loading: false });
        } catch (error: any) {
          console.error('Ошибка загрузки статистики рисков:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось загрузить статистику рисков',
            loading: false 
          });
        }
      },

      // Загрузка рекомендаций по стоп-лоссам
      loadStopLossRecommendations: async () => {
        set({ loading: true, error: null });
        try {
          const recommendations = await riskApi.getStopLossRecommendations();
          set({ stopLossRecommendations: recommendations, loading: false });
        } catch (error: any) {
          console.error('Ошибка загрузки рекомендаций по стоп-лоссам:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось загрузить рекомендации по стоп-лоссам',
            loading: false 
          });
        }
      },

      // Загрузка максимального размера позиции
      loadMaxPositionSize: async (riskTolerance?: 'low' | 'medium' | 'high') => {
        set({ loading: true, error: null });
        try {
          const maxSize = await riskApi.getMaxPositionSize(riskTolerance);
          set({ maxPositionSize: maxSize, loading: false });
        } catch (error: any) {
          console.error('Ошибка загрузки максимального размера позиции:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось загрузить максимальный размер позиции',
            loading: false 
          });
        }
      },

      // Проверка риска сделки
      checkTradeRisk: async (data) => {
        set({ loading: true, error: null });
        try {
          const riskCheck = await riskApi.checkTradeRisk(data);
          set({ tradeRiskCheck: riskCheck, loading: false });
        } catch (error: any) {
          console.error('Ошибка проверки риска сделки:', error);
          set({ 
            error: error.response?.data?.message || 'Не удалось проверить риск сделки',
            loading: false 
          });
        }
      },

      // Очистка ошибок
      clearError: () => set({ error: null }),
    }),
    {
      name: 'risk-storage',
      partialize: (state) => ({
        riskAssessment: state.riskAssessment,
        riskStatistics: state.riskStatistics,
        stopLossRecommendations: state.stopLossRecommendations,
        maxPositionSize: state.maxPositionSize,
      }),
    }
  )
);

// Вспомогательные функции для работы с данными рисков
export const getRiskLevelColor = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low': return '#4caf50'; // зеленый
    case 'medium': return '#ff9800'; // оранжевый
    case 'high': return '#f44336'; // красный
    default: return '#757575'; // серый
  }
};

export const getRiskLevelText = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low': return 'Низкий';
    case 'medium': return 'Средний';
    case 'high': return 'Высокий';
    default: return 'Неизвестно';
  }
};

export const getSeverityColor = (severity: 'warning' | 'critical'): string => {
  switch (severity) {
    case 'warning': return '#ff9800'; // оранжевый
    case 'critical': return '#f44336'; // красный
    default: return '#757575'; // серый
  }
};

export const getPriorityColor = (priority: 'low' | 'medium' | 'high'): string => {
  switch (priority) {
    case 'low': return '#4caf50'; // зеленый
    case 'medium': return '#ff9800'; // оранжевый
    case 'high': return '#f44336'; // красный
    default: return '#757575'; // серый
  }
};

export const formatRiskScore = (score: number): string => {
  if (score < 30) return 'Низкий';
  if (score < 60) return 'Средний';
  return 'Высокий';
};