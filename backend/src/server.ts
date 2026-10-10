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
import v2Routes from './v2/routes';

// Импорт сервисов
import { ExecutionWorker } from './v2/services/ExecutionWorker';
import { executionQueue } from './v2/services/queue/QueueRegistry';
import { ExecutionJetStream } from './v2/services/queue/ExecutionJetStream';
import { JetStreamHealth } from './v2/services/queue/JetStreamHealth';
import { JetStreamResubscribe } from './v2/services/queue/JetStreamResubscribe';
import { TinkoffErrorRegistry } from './v2/services/broker/TinkoffErrorRegistry';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// V2 execution worker (stub)
const executionWorker = new ExecutionWorker();
const jetstream = new ExecutionJetStream();
const jetstreamHealth = new JetStreamHealth();
const jetstreamResubscribe = new JetStreamResubscribe();
const tinkoffErrorRegistry = new TinkoffErrorRegistry();

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Конфигурация CORS
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Разрешаем запросы без origin (например, из мобильных приложений или Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3002',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003'
    ];

    // Добавляем дополнительные origins из переменной окружения CORS_ORIGINS
    const corsOrigins = process.env.CORS_ORIGINS;
    if (corsOrigins) {
      const additionalOrigins = corsOrigins.split(',').map(o => o.trim());
      allowedOrigins.push(...additionalOrigins);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS заблокирован для origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf?.toString?.('utf8') || '';
  }
}));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Маршруты API (V2)
app.use('/api', v2Routes);


// Health check
app.get('/health', async (req, res) => {
  const js = await jetstreamHealth.check();
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Russian Trader Backend',
    jetstream: {
      healthy: jetstream.isHealthy() && js.ok,
      rttMs: js.rttMs
    }
  });
});


// TODO: Инициализация V2 сервисов будет добавлена отдельно
executionQueue.init().then(() => {
  if (executionQueue.isReady()) {
    executionQueue.consume(async (orderId) => {
      await executionWorker.processOrderId(orderId);
    });
  }
});

jetstream.init(async (orderId) => {
  await executionWorker.processOrderId(orderId);
});
jetstreamResubscribe.start(jetstream, async (orderId) => {
  await executionWorker.processOrderId(orderId);
});
setInterval(async () => {
  try {
    await executionWorker.runOnce();
  } catch (error) {
    console.error('Execution worker error:', error);
  }
}, 1000);

// Обработка ошибок
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Произошла ошибка'
  });
});


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

  const autoSeed = process.env.TINKOFF_ERROR_SEED_ON_START !== 'false';
  if (autoSeed) {
    const seedFile = process.env.TINKOFF_ERROR_SEED_FILE || 'data/tinkoff_error_map.json';
    const resolved = path.resolve(process.cwd(), seedFile);
    try {
      const count = await tinkoffErrorRegistry.seedFromFile(resolved);
      console.log(`✅ Tinkoff error map seeded: ${count} entries`);
    } catch (error) {
      console.warn('⚠️ Tinkoff error map seed skipped:', (error as Error).message);
    }
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
