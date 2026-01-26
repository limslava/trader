import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

// Загрузка переменных окружения
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Импорт базы данных
import { postgresDatabase } from './config/postgres';

// Импорт маршрутов и middleware
import marketRoutes from './routes/marketRoutes';
import analysisRoutes from './routes/analysisRoutes';
import portfolioRoutes from './routes/portfolioRoutes';
import authRoutes from './routes/authRoutes';
import riskRoutes from './routes/riskRoutes';
import notificationRoutes from './routes/notificationRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import postgresAuthRoutes from './routes/postgresAuthRoutes';
import pushNotificationRoutes from './routes/pushNotificationRoutes';
import brokerRoutes from './routes/brokerRoutes';
import cacheRoutes from './routes/cacheRoutes';
import mlRoutes from './routes/mlRoutes';
import capitalRoutes from './routes/capitalRoutes';
import { authenticateToken } from './middleware/authMiddleware';

// Импорт сервисов
import { MarketDataService } from './services/MarketDataService';
import { AnalysisService } from './services/AnalysisService';
import { WebSocketService } from './services/WebSocketService';
import { PostgresAuthService } from './services/PostgresAuthService';
import { RiskManagementService } from './services/RiskManagementService';
import { PushNotificationService } from './services/PushNotificationService';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const staticRoot = path.resolve(__dirname, '../../frontend/dist');

// Инициализация WebSocket сервиса
const webSocketService = new WebSocketService();
webSocketService.initialize(server);

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Маршруты API
app.use('/api/market', marketRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/postgres-auth', postgresAuthRoutes);
app.use('/api/push-notifications', pushNotificationRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/capital', authenticateToken, capitalRoutes);

if (isProduction && fs.existsSync(staticRoot)) {
  app.use(express.static(staticRoot));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Russian Trader Backend'
  });
});


// Инициализация сервисов
const marketDataService = new MarketDataService();
const analysisService = new AnalysisService();
const riskManagementService = new RiskManagementService();

// Инициализация сервиса push-уведомлений
const pushNotificationService = new PushNotificationService(
  webSocketService,
  marketDataService,
  analysisService,
  riskManagementService
);

console.log('🔔 Сервис push-уведомлений инициализирован');

// Запуск периодических задач
setInterval(async () => {
  try {
    await marketDataService.updateMarketData();
    console.log('Данные рынка обновлены');
  } catch (error) {
    console.error('Ошибка обновления данных рынка:', error);
  }
}, 60000); // Каждую минуту

// Обработка ошибок
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Произошла ошибка'
  });
});

if (isProduction && fs.existsSync(path.join(staticRoot, 'index.html'))) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      next();
      return;
    }
    res.sendFile(path.join(staticRoot, 'index.html'));
  });
}

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Маршрут не найден',
    path: req.originalUrl
  });
});

// Подключение к базе данных и запуск сервера
const startServer = async () => {
  // Подключаем PostgreSQL
  try {
    await postgresDatabase.connect();
    console.log(`📊 PostgreSQL подключена успешно`);
  } catch (error) {
    console.log(`⚠️ PostgreSQL недоступна, используется временное хранилище`);
    console.log(`💡 Проверьте запуск PostgreSQL контейнера: docker-compose up -d`);
  }
  
  // Инициализация тестового пользователя в PostgreSQL
  try {
    const postgresAuthService = new PostgresAuthService();
    await postgresAuthService.initializeTestUser();
    console.log(`✅ Тестовый пользователь PostgreSQL инициализирован`);
  } catch (error) {
    console.log(`⚠️ Ошибка инициализации тестового пользователя:`, error);
  }
  
  server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 Russian Trader Backend готов к работе`);
    console.log(`🌐 API доступно по адресу: http://localhost:${PORT}/api`);
    console.log(`🔌 WebSocket сервер готов к подключениям`);
    console.log(`💾 Система кэширования инициализирована`);
    console.log(`🤖 ML аналитика активирована`);
  });
};

startServer();

export default app;
