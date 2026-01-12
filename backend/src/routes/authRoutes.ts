import express from 'express';
import { PostgresAuthService } from '../services/PostgresAuthService';
import { authenticateToken } from '../middleware/authMiddleware';
import { LoginRequest, RegisterRequest } from '../types/auth';

const router = express.Router();
const postgresAuthService = new PostgresAuthService();

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
  try {
    const userData: RegisterRequest = req.body;
    
    // Валидация данных
    if (!userData.email || !userData.username || !userData.password) {
      res.status(400).json({
        success: false,
        message: 'Email, имя пользователя и пароль обязательны'
      });
      return;
    }

    if (userData.password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Пароль должен содержать минимум 6 символов'
      });
      return;
    }

    const result = await postgresAuthService.register(userData);
    
    res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован',
      data: result
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Ошибка регистрации'
    });
  }
});

// Вход пользователя
router.post('/login', async (req, res) => {
  try {
    const loginData: LoginRequest = req.body;
    
    // Валидация данных
    if (!loginData.email || !loginData.password) {
      res.status(400).json({
        success: false,
        message: 'Email и пароль обязательны'
      });
      return;
    }

    const result = await postgresAuthService.login(loginData);
    
    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: result
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Ошибка входа'
    });
  }
});

// Демо-вход (для быстрого тестирования)
router.post('/demo-login', async (_req, res) => {
  try {
    // Используем тестового пользователя
    const result = await postgresAuthService.login({
      email: '2720233@gmail.com',
      password: 'test123'
    });
    
    res.json({
      success: true,
      message: 'Демо-вход выполнен успешно',
      data: result
    });
  } catch (error) {
    console.error('Ошибка демо-входа:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка демо-входа'
    });
  }
});

// Получение профиля пользователя (требует аутентификации)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Пользователь не аутентифицирован'
      });
      return;
    }

    const user = await postgresAuthService.getUserById(userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
      return;
    }

    // Возвращаем пользователя без пароля
    const { passwordHash, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения профиля'
    });
  }
});

// Выход пользователя (на клиенте просто удаляем токен)
router.post('/logout', authenticateToken, async (_req, res) => {
  try {
    // В реальном приложении здесь можно добавить токен в черный список
    res.json({
      success: true,
      message: 'Выход выполнен успешно'
    });
  } catch (error) {
    console.error('Ошибка выхода:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка выхода'
    });
  }
});

// Проверка токена
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Пользователь не аутентифицирован'
      });
      return;
    }

    const user = await postgresAuthService.getUserById(userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
      return;
    }

    // Возвращаем пользователя без пароля
    const { passwordHash, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Токен действителен',
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    res.status(401).json({
      success: false,
      message: 'Недействительный токен'
    });
  }
});

// Запрос на сброс пароля (отправка email с токеном)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email обязателен'
      });
      return;
    }

    const result = await postgresAuthService.requestPasswordReset(email);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message
      });
      return;
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Ошибка запроса сброса пароля:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при запросе сброса пароля'
    });
  }
});

// Верификация токена сброса пароля
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Токен обязателен'
      });
      return;
    }

    const result = await postgresAuthService.verifyResetToken(token);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      email: result.email
    });
  } catch (error) {
    console.error('Ошибка верификации токена сброса:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при верификации токена'
    });
  }
});

// Сброс пароля с новым паролем
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword, token } = req.body;
    
    if (!email || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Email и новый пароль обязательны'
      });
      return;
    }

    // Если есть токен, проверяем его
    if (token) {
      const tokenResult = await postgresAuthService.verifyResetToken(token);
      if (!tokenResult.success || tokenResult.email !== email) {
        res.status(400).json({
          success: false,
          message: 'Недействительный или истекший токен'
        });
        return;
      }
    }

    // Проверяем длину пароля
    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Пароль должен содержать минимум 6 символов'
      });
      return;
    }

    const result = await postgresAuthService.resetPassword(email, newPassword);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message
      });
      return;
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Ошибка сброса пароля:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при сбросе пароля'
    });
  }
});

export default router;