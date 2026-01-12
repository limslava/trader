"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = exports.errorHandler = exports.requestLogger = exports.requireRole = exports.authenticateToken = void 0;
const PostgresAuthService_1 = require("../services/PostgresAuthService");
const postgresAuthService = new PostgresAuthService_1.PostgresAuthService();
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
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
        req.user = {
            userId: user.id,
            email: user.email,
            username: user.username
        };
        next();
    }
    catch (error) {
        console.error('Ошибка аутентификации:', error);
        res.status(401).json({
            success: false,
            message: 'Ошибка аутентификации'
        });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        next();
    };
};
exports.requireRole = requireRole;
const requestLogger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`);
    next();
};
exports.requestLogger = requestLogger;
const errorHandler = (error, req, res, next) => {
    console.error('Ошибка сервера:', error);
    res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};
exports.errorHandler = errorHandler;
const corsMiddleware = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
};
exports.corsMiddleware = corsMiddleware;
//# sourceMappingURL=authMiddleware.js.map