import apiClient from './api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  profile?: {
    experienceLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    riskTolerance?: 'LOW' | 'MEDIUM' | 'HIGH';
    investmentGoals?: string[];
  };
}

export interface AuthResponse {
  user: {
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
      theme: 'LIGHT' | 'DARK';
      language: 'RU' | 'EN';
      currency: 'RUB' | 'USD' | 'EUR';
      defaultExchange: 'MOEX' | 'SPB' | 'BINANCE';
    };
    createdAt: string;
    updatedAt: string;
    lastLoginAt?: string;
  };
  token: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export const authApi = {
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  async register(userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  async demoLogin(): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post('/auth/demo-login');
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post('/auth/refresh-token', { refreshToken });
    return response.data;
  },

  async getProfile(): Promise<ApiResponse<any>> {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },

  async updateProfile(profile: any): Promise<ApiResponse<any>> {
    const response = await apiClient.put('/auth/profile', profile);
    return response.data;
  },

  async updatePreferences(preferences: any): Promise<ApiResponse<any>> {
    const response = await apiClient.put('/auth/preferences', preferences);
    return response.data;
  },

  async logout(): Promise<ApiResponse<void>> {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  async verifyToken(): Promise<ApiResponse<any>> {
    const response = await apiClient.get('/auth/verify');
    return response.data;
  },

  // Восстановление пароля
  async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  async verifyResetToken(token: string): Promise<ApiResponse<{ message: string; email?: string }>> {
    const response = await apiClient.post('/auth/verify-reset-token', { token });
    return response.data;
  },

  async resetPassword(email: string, newPassword: string, token?: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post('/auth/reset-password', {
      email,
      newPassword,
      token
    });
    return response.data;
  }
};