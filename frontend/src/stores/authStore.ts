import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../services/authApi';
import { useThemeStore } from './themeStore';

export interface User {
  id: string;
  email: string;
  username: string;
  profile: {
    experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
    investmentGoals: string[];
  };
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
      priceAlerts: boolean;
      riskAlerts: boolean;
    };
    theme: 'LIGHT' | 'DARK' | 'SYSTEM';
    language: 'RU' | 'EN';
    currency: 'RUB' | 'USD' | 'EUR';
    defaultExchange: 'MOEX' | 'SPB' | 'BINANCE';
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshTokenValue: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    email: string;
    username: string;
    password: string;
    profile?: Partial<User['profile']>;
  }) => Promise<void>;
  logout: () => void;
  refreshAuthToken: () => Promise<void>;
  clearError: () => void;
  updateProfile: (profile: Partial<User['profile']>) => Promise<void>;
  updatePreferences: (preferences: Partial<User['preferences']>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshTokenValue: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authApi.login({ email, password });
          
          if (response.success && response.data) {
            set({
              user: response.data.user,
              token: response.data.token,
              refreshTokenValue: response.data.refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          } else {
            throw new Error(response.message || 'Ошибка входа');
          }
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error.response?.data?.message || error.message || 'Ошибка входа' 
          });
          throw error;
        }
      },

      register: async (userData) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authApi.register(userData);
          
          if (response.success && response.data) {
            set({
              user: response.data.user,
              token: response.data.token,
              refreshTokenValue: response.data.refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          } else {
            throw new Error(response.message || 'Ошибка регистрации');
          }
        } catch (error: any) {
          set({ 
            isLoading: false, 
            error: error.response?.data?.message || error.message || 'Ошибка регистрации' 
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshTokenValue: null,
          isAuthenticated: false,
          error: null
        });
      },

      refreshAuthToken: async () => {
        const { refreshTokenValue } = get();
        
        if (!refreshTokenValue) {
          get().logout();
          return;
        }

        try {
          const response = await authApi.refreshToken(refreshTokenValue);
          
          if (response.success && response.data) {
            set({
              token: response.data.token,
              refreshTokenValue: response.data.refreshToken
            });
          } else {
            throw new Error('Не удалось обновить токен');
          }
        } catch (error) {
          console.error('Ошибка обновления токена:', error);
          get().logout();
        }
      },

      clearError: () => {
        set({ error: null });
      },

      updateProfile: async (profile) => {
        const { user } = get();
        
        if (!user) {
          throw new Error('Пользователь не авторизован');
        }

        try {
          const response = await authApi.updateProfile(profile);
          
          if (response.success && response.data) {
            set({ user: response.data });
          } else {
            throw new Error(response.message || 'Ошибка обновления профиля');
          }
        } catch (error: any) {
          set({ 
            error: error.response?.data?.message || error.message || 'Ошибка обновления профиля' 
          });
          throw error;
        }
      },

      updatePreferences: async (preferences) => {
        const { user } = get();
        
        if (!user) {
          throw new Error('Пользователь не авторизован');
        }

        try {
          const response = await authApi.updatePreferences(preferences);
          
          if (response.success && response.data) {
            set({ user: response.data });
            
            // Синхронизация темы с системой тем
            if (preferences.theme && preferences.theme !== 'SYSTEM') {
              const { setTheme } = useThemeStore.getState();
              setTheme(preferences.theme.toLowerCase() as 'light' | 'dark');
            }
          } else {
            throw new Error(response.message || 'Ошибка обновления настроек');
          }
        } catch (error: any) {
          set({
            error: error.response?.data?.message || error.message || 'Ошибка обновления настроек'
          });
          throw error;
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshTokenValue: state.refreshTokenValue,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

// Автоматическое обновление токена перед истечением срока
setInterval(() => {
  const { isAuthenticated, refreshAuthToken } = useAuthStore.getState();
  
  if (isAuthenticated && refreshAuthToken) {
    refreshAuthToken();
  }
}, 30 * 60 * 1000); // Каждые 30 минут