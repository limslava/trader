import express from 'express';
import { PostgresAuthService } from '../services/PostgresAuthService';
import { LoginRequest, RegisterRequest } from '../types/auth';

const router = express.Router();
const postgresAuthService = new PostgresAuthService();

// Регистрация пользователя
router.post('/register', async (req, res) => {
  try {
    const userData: RegisterRequest = req.body;
    
    // Валидация данных
    if (!userData.email || !userData.password || !userData.username) {
      return res.status(400).json({
        error: 'Email, username и password обязательны для заполнения'
      });
    }

    const result = await postgresAuthService.register(userData);
    return res.status(201).json(result);
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Ошибка при регистрации'
    });
  }
});

// Вход пользователя
router.post('/login', async (req, res) => {
  try {
    const credentials: LoginRequest = req.body;
    
    // Валидация данных
    if (!credentials.email || !credentials.password) {
      return res.status(400).json({
        error: 'Email и password обязательны для заполнения'
      });
    }

    const result = await postgresAuthService.login(credentials);
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Ошибка входа:', error);
    return res.status(401).json({
      error: error instanceof Error ? error.message : 'Ошибка при входе'
    });
  }
});

// Получение информации о текущем пользователе
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Токен авторизации отсутствует'
      });
    }

    const token = authHeader.substring(7);
    const decoded = await postgresAuthService.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'Неверный токен авторизации'
      });
    }

    const user = await postgresAuthService.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'Пользователь не найден'
      });
    }

    // Возвращаем пользователя без пароля
    const { passwordHash, ...userWithoutPassword } = user;
    return res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error('❌ Ошибка получения пользователя:', error);
    return res.status(500).json({
      error: 'Ошибка при получении информации о пользователе'
    });
  }
});

// Проверка токена
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Токен обязателен для проверки'
      });
    }

    const decoded = await postgresAuthService.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        valid: false,
        error: 'Неверный токен'
      });
    }

    return res.status(200).json({
      valid: true,
      user: decoded
    });
  } catch (error) {
    console.error('❌ Ошибка проверки токена:', error);
    return res.status(500).json({
      valid: false,
      error: 'Ошибка при проверке токена'
    });
  }
});

export default router;