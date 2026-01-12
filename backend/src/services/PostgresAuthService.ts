import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { postgresDatabase } from '../config/postgres';
import { emailService } from '../config/email';
import { LoginRequest, RegisterRequest, AuthResponse, User, UserProfile, UserPreferences } from '../types/auth';

export class PostgresAuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'russian-trader-secret-key-2025';
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      // Проверяем, существует ли пользователь с таким email
      const existingUser = await postgresDatabase.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Пользователь с таким email уже существует');
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Создаем профиль пользователя по умолчанию
      const defaultProfile: UserProfile = {
        firstName: userData.profile?.firstName || '',
        lastName: userData.profile?.lastName || '',
        experienceLevel: 'BEGINNER',
        riskTolerance: 'MEDIUM',
        investmentGoals: ['Обучение', 'Рост капитала']
      };

      const defaultPreferences: UserPreferences = {
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
      };

      // Создаем нового пользователя
      const result = await postgresDatabase.query(
        `INSERT INTO users (email, username, password_hash, profile, preferences, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, email, username, profile, preferences, created_at, updated_at`,
        [
          userData.email,
          userData.username,
          hashedPassword,
          JSON.stringify(defaultProfile),
          JSON.stringify(defaultPreferences)
        ]
      );

      const newUser = result.rows[0];

      // Создаем JWT токен
      const token = jwt.sign(
        {
          userId: newUser.id,
          email: newUser.email,
          username: newUser.username
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      // Создаем refresh token
      const refreshToken = jwt.sign(
        { userId: newUser.id },
        this.jwtSecret + '-refresh',
        { expiresIn: '7d' }
      );

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          profile: newUser.profile,
          preferences: newUser.preferences,
          createdAt: newUser.created_at,
          updatedAt: newUser.updated_at
        },
        token,
        refreshToken
      };
    } catch (error) {
      console.error('❌ Ошибка регистрации:', error);
      throw error;
    }
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      // Ищем пользователя по email
      const result = await postgresDatabase.query(
        'SELECT id, email, username, password_hash, profile, preferences, created_at, updated_at FROM users WHERE email = $1',
        [credentials.email]
      );

      if (result.rows.length === 0) {
        throw new Error('Пользователь не найден');
      }

      const user = result.rows[0];

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Неверный пароль');
      }

      // Создаем JWT токен
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      // Создаем refresh token
      const refreshToken = jwt.sign(
        { userId: user.id },
        this.jwtSecret + '-refresh',
        { expiresIn: '7d' }
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          profile: user.profile,
          preferences: user.preferences,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        token,
        refreshToken
      };
    } catch (error) {
      console.error('❌ Ошибка входа:', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const result = await postgresDatabase.query(
        'SELECT id, email, username, profile, preferences, created_at, updated_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.password_hash,
        profile: user.profile,
        preferences: user.preferences,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      console.error('❌ Ошибка получения пользователя:', error);
      return null;
    }
  }

  async verifyToken(token: string): Promise<{ userId: string; email: string; username: string } | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string; email: string; username: string };
      return decoded;
    } catch (error) {
      console.error('❌ Ошибка верификации токена:', error);
      return null;
    }
  }

  // Метод для инициализации тестового пользователя
  async initializeTestUser(): Promise<void> {
    try {
      // Проверяем, существует ли тестовый пользователь
      const existingUser = await postgresDatabase.query(
        'SELECT id FROM users WHERE email = $1',
        ['2720233@gmail.com']
      );

      if (existingUser.rows.length === 0) {
        // Создаем тестового пользователя
        const hashedPassword = await bcrypt.hash('test123', 12);
        const defaultProfile = {
          firstName: 'Тестовый',
          lastName: 'Пользователь',
          experienceLevel: 'BEGINNER',
          riskTolerance: 'MEDIUM',
          investmentGoals: ['Обучение', 'Рост капитала']
        };
        const defaultPreferences = {
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
        };

        await postgresDatabase.query(
          `INSERT INTO users (email, username, password_hash, profile, preferences, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            '2720233@gmail.com',
            'test_user',
            hashedPassword,
            JSON.stringify(defaultProfile),
            JSON.stringify(defaultPreferences)
          ]
        );
        console.log('✅ Тестовый пользователь создан');
      } else {
        console.log('✅ Тестовый пользователь уже существует');
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации тестового пользователя:', error);
    }
  }

  // Метод для сброса пароля
  async resetPassword(email: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Ищем пользователя по email
      const result = await postgresDatabase.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          message: 'Пользователь с таким email не найден'
        };
      }

      // Хешируем новый пароль
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Обновляем пароль в базе данных
      await postgresDatabase.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
        [hashedPassword, email]
      );

      return {
        success: true,
        message: 'Пароль успешно изменен'
      };
    } catch (error) {
      console.error('❌ Ошибка сброса пароля:', error);
      return {
        success: false,
        message: 'Ошибка при сбросе пароля'
      };
    }
  }

  // Метод для запроса сброса пароля (отправка email с токеном сброса)
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; resetToken?: string }> {
    try {
      // Ищем пользователя по email
      const result = await postgresDatabase.query(
        'SELECT id, email, username, profile FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        // Возвращаем успех даже если пользователь не найден (для безопасности)
        return {
          success: true,
          message: 'Если пользователь с таким email существует, инструкции по сбросу пароля будут отправлены'
        };
      }

      const user = result.rows[0];
      const username = user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : user.username;

      // Создаем токен сброса пароля (действителен 1 час)
      const resetToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          type: 'password_reset'
        },
        this.jwtSecret + '-reset',
        { expiresIn: '1h' }
      );

      // Отправляем email с токеном сброса пароля
      const emailSent = await emailService.sendPasswordResetEmail(email, resetToken, username);

      if (emailSent) {
        console.log(`📧 Письмо для сброса пароля отправлено на ${email}`);
        return {
          success: true,
          message: 'Инструкции по сбросу пароля отправлены на email'
        };
      } else {
        // Если email не отправлен, показываем токен в логах (для демо-режима)
        console.log(`🔐 Токен сброса пароля для ${email}: ${resetToken}`);
        console.log(`📧 В демо-режиме письмо не отправлено. Токен можно использовать для тестирования.`);
        
        return {
          success: true,
          message: 'Инструкции по сбросу пароля отправлены на email (демо-режим)',
          resetToken // В демо-режиме возвращаем токен для тестирования
        };
      }
    } catch (error) {
      console.error('❌ Ошибка запроса сброса пароля:', error);
      return {
        success: false,
        message: 'Ошибка при запросе сброса пароля'
      };
    }
  }

  // Метод для верификации токена сброса пароля
  async verifyResetToken(token: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret + '-reset') as {
        userId: string;
        email: string;
        type: string
      };

      if (decoded.type !== 'password_reset') {
        return {
          success: false,
          message: 'Неверный тип токена'
        };
      }

      return {
        success: true,
        message: 'Токен действителен',
        email: decoded.email
      };
    } catch (error) {
      console.error('❌ Ошибка верификации токена сброса:', error);
      return {
        success: false,
        message: 'Токен недействителен или истек'
      };
    }
  }
}

export default PostgresAuthService;