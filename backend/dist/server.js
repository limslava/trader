"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
dotenv_1.default.config();
const postgres_1 = require("./config/postgres");
const marketRoutes_1 = __importDefault(require("./routes/marketRoutes"));
const analysisRoutes_1 = __importDefault(require("./routes/analysisRoutes"));
const portfolioRoutes_1 = __importDefault(require("./routes/portfolioRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const riskRoutes_1 = __importDefault(require("./routes/riskRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const postgresAuthRoutes_1 = __importDefault(require("./routes/postgresAuthRoutes"));
const pushNotificationRoutes_1 = __importDefault(require("./routes/pushNotificationRoutes"));
const brokerRoutes_1 = __importDefault(require("./routes/brokerRoutes"));
const cacheRoutes_1 = __importDefault(require("./routes/cacheRoutes"));
const mlRoutes_1 = __importDefault(require("./routes/mlRoutes"));
const capitalRoutes_1 = __importDefault(require("./routes/capitalRoutes"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const MarketDataService_1 = require("./services/MarketDataService");
const AnalysisService_1 = require("./services/AnalysisService");
const WebSocketService_1 = require("./services/WebSocketService");
const PostgresAuthService_1 = require("./services/PostgresAuthService");
const RiskManagementService_1 = require("./services/RiskManagementService");
const PushNotificationService_1 = require("./services/PushNotificationService");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 3001;
const webSocketService = new WebSocketService_1.WebSocketService();
webSocketService.initialize(server);
app.use((0, helmet_1.default)({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.use('/api/market', marketRoutes_1.default);
app.use('/api/analysis', analysisRoutes_1.default);
app.use('/api/portfolio', portfolioRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/risk', riskRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/postgres-auth', postgresAuthRoutes_1.default);
app.use('/api/push-notifications', pushNotificationRoutes_1.default);
app.use('/api/broker', brokerRoutes_1.default);
app.use('/api/cache', cacheRoutes_1.default);
app.use('/api/ml', mlRoutes_1.default);
app.use('/api/capital', authMiddleware_1.authenticateToken, capitalRoutes_1.default);
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Russian Trader Backend'
    });
});
const marketDataService = new MarketDataService_1.MarketDataService();
const analysisService = new AnalysisService_1.AnalysisService();
const riskManagementService = new RiskManagementService_1.RiskManagementService();
const pushNotificationService = new PushNotificationService_1.PushNotificationService(webSocketService, marketDataService, analysisService, riskManagementService);
console.log('🔔 Сервис push-уведомлений инициализирован');
setInterval(async () => {
    try {
        await marketDataService.updateMarketData();
        console.log('Данные рынка обновлены');
    }
    catch (error) {
        console.error('Ошибка обновления данных рынка:', error);
    }
}, 60000);
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).json({
        error: 'Внутренняя ошибка сервера',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Произошла ошибка'
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Маршрут не найден',
        path: req.originalUrl
    });
});
const startServer = async () => {
    try {
        await postgres_1.postgresDatabase.connect();
        console.log(`📊 PostgreSQL подключена успешно`);
    }
    catch (error) {
        console.log(`⚠️ PostgreSQL недоступна, используется временное хранилище`);
        console.log(`💡 Проверьте запуск PostgreSQL контейнера: docker-compose up -d`);
    }
    try {
        const postgresAuthService = new PostgresAuthService_1.PostgresAuthService();
        await postgresAuthService.initializeTestUser();
        console.log(`✅ Тестовый пользователь PostgreSQL инициализирован`);
    }
    catch (error) {
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
exports.default = app;
//# sourceMappingURL=server.js.map