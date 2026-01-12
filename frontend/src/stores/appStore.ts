import { create } from 'zustand';
import { marketApi, analysisApi, portfolioApi } from '../services/api';
import type { Asset, PriceData, AnalysisResult } from '../services/api';
import webSocketService, { PriceUpdateMessage, RiskAlert, RecommendationUpdate } from '../services/websocket';

// Типы для состояния приложения
interface AppState {
  // Рыночные данные
  assets: Asset[];
  prices: Map<string, PriceData>;
  popularStocks: Asset[];
  popularCryptos: Asset[];
  
  // Аналитика
  analyses: Map<string, AnalysisResult>;
  beginnerRecommendations: AnalysisResult[];
  marketInsights: any;
  
  // Портфель
  portfolios: any[];
  selectedPortfolio: any | null;
  
  // UI состояние
  loading: boolean;
  error: string | null;
  websocketConnected: boolean;
  lastPriceUpdate: string | null;
  
  // Действия для рыночных данных
  fetchPopularAssets: () => Promise<void>;
  fetchAssetPrice: (symbol: string, exchange?: string) => Promise<void>;
  fetchAssetAnalysis: (symbol: string) => Promise<void>;
  searchAssets: (query: string) => Promise<Asset[]>;
  
  // Действия для аналитики
  fetchBeginnerRecommendations: () => Promise<void>;
  fetchMarketInsights: () => Promise<void>;
  analyzePortfolioRisk: (positions: any[]) => Promise<any>;
  
  // Действия для портфеля
  fetchPortfolios: () => Promise<void>;
  createPortfolio: (portfolioData: any) => Promise<void>;
  addPosition: (portfolioId: string, positionData: any) => Promise<void>;
  removePosition: (portfolioId: string, positionId: string) => Promise<void>;
  
  // Утилиты
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setWebsocketConnected: (connected: boolean) => void;
  setLastPriceUpdate: (timestamp: string) => void;
  initializeWebSocket: () => () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Начальное состояние
  assets: [],
  prices: new Map(),
  popularStocks: [],
  popularCryptos: [],
  analyses: new Map(),
  beginnerRecommendations: [],
  marketInsights: null,
  portfolios: [],
  selectedPortfolio: null,
  loading: false,
  error: null,
  websocketConnected: false,
  lastPriceUpdate: null,

  // Действия для рыночных данных
  fetchPopularAssets: async () => {
    try {
      set({ loading: true, error: null });
      
      const [stocks, cryptos] = await Promise.all([
        marketApi.getPopularRussianStocks(),
        marketApi.getPopularCryptos()
      ]);
      
      // Обновляем цены для всех активов
      const allSymbols = [...stocks, ...cryptos].map(asset => asset.symbol);
      const prices = await marketApi.getMultiplePrices(allSymbols);
      
      const priceMap = new Map();
      prices.forEach(price => {
        priceMap.set(price.symbol, price);
      });
      
      set({
        popularStocks: stocks,
        popularCryptos: cryptos,
        prices: priceMap,
        loading: false
      });

      // Инициализируем WebSocket после загрузки активов
      get().initializeWebSocket();
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка загрузки рыночных данных',
        loading: false 
      });
    }
  },

  fetchAssetPrice: async (symbol: string, exchange?: string) => {
    try {
      const price = await marketApi.getPrice(symbol, exchange);
      const { prices } = get();
      const newPrices = new Map(prices);
      newPrices.set(symbol, price);
      set({ prices: newPrices });
    } catch (error: any) {
      set({ error: error.message || `Ошибка загрузки цены для ${symbol}` });
    }
  },

  fetchAssetAnalysis: async (symbol: string) => {
    try {
      set({ loading: true, error: null });
      
      const analysis = await marketApi.getAssetAnalysis(symbol);
      const { analyses } = get();
      const newAnalyses = new Map(analyses);
      newAnalyses.set(symbol, analysis);
      
      set({ 
        analyses: newAnalyses,
        loading: false 
      });
      
    } catch (error: any) {
      set({ 
        error: error.message || `Ошибка анализа для ${symbol}`,
        loading: false 
      });
    }
  },

  searchAssets: async (query: string): Promise<Asset[]> => {
    try {
      set({ loading: true, error: null });
      
      const results = await marketApi.searchAssets(query);
      set({ loading: false });
      return results;
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка поиска активов',
        loading: false 
      });
      return [];
    }
  },

  // Действия для аналитики
  fetchBeginnerRecommendations: async () => {
    try {
      set({ loading: true, error: null });
      
      const recommendations = await analysisApi.getBeginnerRecommendations();
      set({ 
        beginnerRecommendations: recommendations,
        loading: false 
      });
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка загрузки рекомендаций',
        loading: false 
      });
    }
  },

  fetchMarketInsights: async () => {
    try {
      set({ loading: true, error: null });
      
      const insights = await analysisApi.getMarketInsights();
      set({ 
        marketInsights: insights,
        loading: false 
      });
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка загрузки рыночных инсайтов',
        loading: false 
      });
    }
  },

  analyzePortfolioRisk: async (positions: any[]): Promise<any> => {
    try {
      set({ loading: true, error: null });
      
      const result = await analysisApi.analyzePortfolioRisk(positions);
      set({ loading: false });
      return result;
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка анализа риска портфеля',
        loading: false 
      });
      throw error;
    }
  },

  // Действия для портфеля
  fetchPortfolios: async () => {
    try {
      set({ loading: true, error: null });
      
      const portfolios = await portfolioApi.getPortfolios();
      set({ 
        portfolios,
        selectedPortfolio: portfolios[0] || null,
        loading: false 
      });
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка загрузки портфелей',
        loading: false 
      });
    }
  },

  createPortfolio: async (portfolioData: any) => {
    try {
      set({ loading: true, error: null });
      
      const newPortfolio = await portfolioApi.createPortfolio(portfolioData);
      const { portfolios } = get();
      
      set({ 
        portfolios: [...portfolios, newPortfolio],
        selectedPortfolio: newPortfolio,
        loading: false 
      });
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка создания портфеля',
        loading: false 
      });
    }
  },

  addPosition: async (portfolioId: string, positionData: any) => {
    try {
      set({ loading: true, error: null });
      
      const newPosition = await portfolioApi.addPosition(portfolioId, positionData);
      const { selectedPortfolio } = get();
      
      if (selectedPortfolio && selectedPortfolio.id === portfolioId) {
        const updatedPortfolio = {
          ...selectedPortfolio,
          positions: [...(selectedPortfolio.positions || []), newPosition]
        };
        set({ selectedPortfolio: updatedPortfolio });
      }
      
      set({ loading: false });
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка добавления позиции',
        loading: false 
      });
    }
  },

  removePosition: async (portfolioId: string, positionId: string) => {
    try {
      set({ loading: true, error: null });
      
      await portfolioApi.removePosition(portfolioId, positionId);
      const { selectedPortfolio } = get();
      
      if (selectedPortfolio && selectedPortfolio.id === portfolioId) {
        const updatedPortfolio = {
          ...selectedPortfolio,
          positions: selectedPortfolio.positions?.filter((p: any) => p.id !== positionId) || []
        };
        set({ selectedPortfolio: updatedPortfolio });
      }
      
      set({ loading: false });
      
    } catch (error: any) {
      set({ 
        error: error.message || 'Ошибка удаления позиции',
        loading: false 
      });
    }
  },

  // Утилиты
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
  setWebsocketConnected: (connected: boolean) => set({ websocketConnected: connected }),
  setLastPriceUpdate: (timestamp: string) => set({ lastPriceUpdate: timestamp }),

  // Инициализация WebSocket соединения
  initializeWebSocket: () => {
    // Подписываемся на события WebSocket
    const unsubscribePriceUpdate = webSocketService.onPriceUpdate((data: PriceUpdateMessage) => {
      const { prices: priceUpdates, timestamp } = data;
      
      // Защита от ошибок формата данных
      if (!Array.isArray(priceUpdates)) {
        console.error('Некорректный формат данных цен:', priceUpdates);
        return;
      }
      
      set(state => {
        const newPrices = new Map(state.prices);
        
        priceUpdates.forEach(update => {
          if (update && update.symbol) {
            const priceData: PriceData = {
              symbol: update.symbol,
              price: update.currentPrice || 0,
              change: update.change || 0,
              changePercent: update.changePercent || 0,
              timestamp: new Date(update.timestamp || new Date().toISOString())
            };
            newPrices.set(update.symbol, priceData);
          }
        });
        
        return {
          prices: newPrices,
          lastPriceUpdate: timestamp
        };
      });
    });
    
    const unsubscribeRiskAlert = webSocketService.onRiskAlert((alert: RiskAlert) => {
      // Можно добавить обработку предупреждений о рисках
      console.log('Risk alert received:', alert);
    });
    
    const unsubscribeRecommendation = webSocketService.onRecommendation((recommendation: RecommendationUpdate) => {
      // Можно добавить обработку новых рекомендаций
      console.log('New recommendation received:', recommendation);
    });
    
    const unsubscribeConnectionChange = webSocketService.onConnectionChange((connected: boolean) => {
      set({ websocketConnected: connected });
    });
    
    // Подключаемся к WebSocket
    webSocketService.connect();
    
    // Возвращаем функцию для очистки подписок
    return () => {
      unsubscribePriceUpdate();
      unsubscribeRiskAlert();
      unsubscribeRecommendation();
      unsubscribeConnectionChange();
      webSocketService.disconnect();
    };
  },
}));

// Селекторы для удобства использования
export const appSelectors = {
  // Получить актив по символу
  getAssetBySymbol: (symbol: string) => (state: AppState) => {
    const allAssets = [...state.popularStocks, ...state.popularCryptos];
    return allAssets.find(asset => asset.symbol === symbol);
  },
  
  // Получить цену по символу
  getPriceBySymbol: (symbol: string) => (state: AppState) => {
    return state.prices.get(symbol);
  },
  
  // Получить анализ по символу
  getAnalysisBySymbol: (symbol: string) => (state: AppState) => {
    return state.analyses.get(symbol);
  },
  
  // Получить активы с ценами
  getAssetsWithPrices: (state: AppState) => {
    const allAssets = [...state.popularStocks, ...state.popularCryptos];
    return allAssets.map(asset => ({
      ...asset,
      currentPrice: state.prices.get(asset.symbol)?.price,
      change: state.prices.get(asset.symbol)?.change,
      changePercent: state.prices.get(asset.symbol)?.changePercent,
    }));
  },
  
  // Получить топ рекомендаций
  getTopRecommendations: (count: number = 5) => (state: AppState) => {
    return state.beginnerRecommendations
      .slice(0, count)
      .sort((a, b) => b.confidence - a.confidence);
  },
};