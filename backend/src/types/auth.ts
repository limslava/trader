export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  profile: Partial<UserProfile>;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  token: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  iat: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  profile: UserProfile;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  investmentGoals: string[];
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    push: boolean;
    priceAlerts: boolean;
    riskAlerts: boolean;
  };
  theme: 'LIGHT' | 'DARK' | 'AUTO';
  language: 'RU' | 'EN';
  currency: 'RUB' | 'USD' | 'EUR';
  defaultExchange: 'MOEX' | 'BINANCE' | 'SPB';
}

// Мок-данные для демонстрации
export const mockUsers: User[] = [
  {
    id: '1',
    email: 'demo@russian-trader.ru',
    username: 'demo_trader',
    passwordHash: '$2b$10$examplehash', // Фиктивный хеш, будет заменен реальным
    profile: {
      firstName: 'Демо',
      lastName: 'Трейдер',
      experienceLevel: 'BEGINNER',
      riskTolerance: 'MEDIUM',
      investmentGoals: ['Обучение', 'Пассивный доход', 'Рост капитала']
    },
    preferences: {
      notifications: {
        email: true,
        push: true,
        priceAlerts: true,
        riskAlerts: true
      },
      theme: 'LIGHT',
      language: 'RU',
      currency: 'RUB',
      defaultExchange: 'MOEX'
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    lastLoginAt: new Date()
  }
];