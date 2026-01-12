import { Request, Response, NextFunction } from 'express';
import { PostgresAuthService } from '../services/PostgresAuthService';

const postgresAuthService = new PostgresAuthService();

// Расширяем интерфейс Request для добавления пользователя
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        username: string;
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('🔐 Auth middleware:', {
      url: req.url,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
      hasToken: !!token,
      tokenLength: token ? token.length : 0
    });

    if (!token) {
      console.log('❌ No token provided for protected route:', req.url);
      res.status(401).json({
        success: false,
        message: 'Токен доступа не предоставлен'
      });
      return;
    }

    const decoded = await postgresAuthService.verifyToken(token);
    if (!decoded) {
      console.log('❌ Invalid token for route:', req.url);
      res.status(401).json({
        success: false,
        message: 'Недействительный токен'
      });
      return;
    }

    // Получаем полную информацию о пользователе
    const user = await postgresAuthService.getUserById(decoded.userId);
    
    if (!user) {
      console.log('❌ User not found for token:', req.url);
      res.status(401).json({
        success: false,
        message: 'Пользователь не найден'
      });
      return;
    }

    console.log('✅ Token validated successfully for user:', {
      email: user.email,
      userId: user.id,
      username: user.username
    });
    
    // Добавляем информацию о пользователе в запрос
    req.user = {
      userId: user.id,
      email: user.email,
      username: user.username
    };

    next();
  } catch (error) {
    console.error('Ошибка аутентификации:', error);
    res.status(401).json({
      success: false,
      message: 'Ошибка аутентификации'
    });
  }
};

// Middleware для проверки ролей (можно расширить в будущем)
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // В демо-версии все пользователи имеют доступ
    // В реальном приложении здесь можно проверять роли пользователя
    next();
  };
};

// Middleware для логирования запросов (опционально)
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`);
  
  next();
};

// Middleware для обработки ошибок
export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Ошибка сервера:', error);
  
  res.status(500).json({
    success: false,
    message: 'Внутренняя ошибка сервера',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// Middleware для проверки CORS (уже настроен в server.ts, но можно расширить)
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
};