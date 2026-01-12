import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Базовый URL для API
const API_BASE_URL = 'http://localhost:3001/api';

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для добавления токена авторизации
apiClient.interceptors.request.use(
  (config) => {
    const { token, isAuthenticated } = useAuthStore.getState();
    
    if (token && isAuthenticated) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('API Request with auth token:', {
        url: config.url,
        method: config.method,
        hasToken: !!token,
        tokenLength: token.length,
        isAuthenticated
      });
    } else {
      console.log('API Request without auth token:', {
        url: config.url,
        method: config.method,
        isAuthenticated,
        hasToken: !!token
      });
      
      // Если запрос к защищенному маршруту, но токена нет, логируем предупреждение
      if (config.url?.includes('/portfolio') || config.url?.includes('/analytics')) {
        console.warn('⚠️ Protected route requested without auth token:', config.url);
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор для обработки ошибок
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    
    // Автоматический logout при 401 ошибке
    if (error.response?.status === 401) {
      console.log('401 error detected, checking auth state before logout');
      const { isAuthenticated, token, logout } = useAuthStore.getState();
      console.log('Auth state before logout:', { isAuthenticated, hasToken: !!token });
      
      // Временно отключаем автоматический logout для отладки
      // logout();
      console.log('401 error - would normally logout, but disabled for debugging');
    }
    
    return Promise.reject(error);
  }
);

// Типы для API ответов
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

// Интерфейсы для рыночных данных
export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  timestamp: Date;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  exchange: string;
  currency: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

export interface TechnicalIndicators {
  rsi: {
    value: number;
    signal: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';
  };
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
}

export interface AnalysisResult {
  symbol: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'STRONG_BUY' | 'STRONG_SELL';
  confidence: number;
  reasoning: string;
  technicalScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  priceTarget: number;
  stopLoss: number;
  takeProfit: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  timestamp: string;
}

// API методы для рыночных данных
export const marketApi = {
  // Получить цену актива
  getPrice: async (symbol: string, exchange?: string): Promise<PriceData> => {
    const response = await apiClient.get<ApiResponse<PriceData>>(
      `/market/price/${symbol}`,
      { params: { exchange } }
    );
    return response.data.data;
  },

  // Получить цены нескольких активов
  getMultiplePrices: async (symbols: string[]): Promise<PriceData[]> => {
    const response = await apiClient.post<ApiResponse<PriceData[]>>('/market/prices', {
      symbols
    });
    return response.data.data;
  },

  // Получить технические индикаторы
  getTechnicalIndicators: async (symbol: string): Promise<TechnicalIndicators> => {
    const response = await apiClient.get<ApiResponse<TechnicalIndicators>>(
      `/market/indicators/${symbol}`
    );
    return response.data.data;
  },

  // Получить популярные российские акции
  getPopularRussianStocks: async (): Promise<Asset[]> => {
    const response = await apiClient.get<ApiResponse<Asset[]>>('/market/stocks/popular');
    return response.data.data;
  },

  // Получить популярные криптовалюты
  getPopularCryptos: async (): Promise<Asset[]> => {
    const response = await apiClient.get<ApiResponse<Asset[]>>('/market/crypto/popular');
    return response.data.data;
  },

  // Поиск активов
  searchAssets: async (query: string): Promise<Asset[]> => {
    const response = await apiClient.get<ApiResponse<Asset[]>>('/market/search', {
      params: { query }
    });
    return response.data.data;
  },

  // Получить анализ актива
  getAssetAnalysis: async (symbol: string): Promise<AnalysisResult> => {
    const response = await apiClient.get<ApiResponse<AnalysisResult>>(
      `/market/analysis/${symbol}`
    );
    return response.data.data;
  },
};

// API методы для аналитики
export const analysisApi = {
  // Полный анализ актива
  analyzeAsset: async (symbol: string): Promise<AnalysisResult> => {
    const response = await apiClient.get<ApiResponse<AnalysisResult>>(
      `/analysis/asset/${symbol}`
    );
    return response.data.data;
  },

  // Анализ нескольких активов
  analyzeMultipleAssets: async (symbols: string[]): Promise<AnalysisResult[]> => {
    const response = await apiClient.post<ApiResponse<AnalysisResult[]>>('/analysis/assets', {
      symbols
    });
    return response.data.data;
  },

  // Рекомендации для новичков
  getBeginnerRecommendations: async (): Promise<AnalysisResult[]> => {
    const response = await apiClient.get<ApiResponse<AnalysisResult[]>>(
      '/analysis/recommendations/beginner'
    );
    return response.data.data;
  },

  // Анализ риска портфеля
  analyzePortfolioRisk: async (positions: any[]): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/analysis/portfolio-risk', {
      positions
    });
    return response.data.data;
  },

  // Получить рыночные инсайты
  getMarketInsights: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/analysis/insights');
    return response.data.data;
  },
};

// API методы для портфеля
export const portfolioApi = {
  // Получить портфели пользователя
  getPortfolios: async (): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/portfolio');
    return response.data.data;
  },

  // Создать новый портфель
  createPortfolio: async (portfolioData: any): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/portfolio', portfolioData);
    return response.data.data;
  },

  // Добавить позицию в портфель
  addPosition: async (portfolioId: string, positionData: any): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/portfolio/${portfolioId}/positions`,
      positionData
    );
    return response.data.data;
  },

  // Удалить позицию из портфеля
  removePosition: async (portfolioId: string, positionId: string): Promise<void> => {
    await apiClient.delete(`/portfolio/${portfolioId}/positions/${positionId}`);
  },

  // Получить транзакции портфеля
  getTransactions: async (portfolioId: string): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>(
      `/portfolio/${portfolioId}/transactions`
    );
    return response.data.data;
  },

  // Обновить цены портфеля с реальными котировками
  updatePortfolioPrices: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
      '/portfolio/update-prices'
    );
    return response.data.data;
  },
};

export default apiClient;