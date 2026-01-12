"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PostgresAuthService_1 = require("../services/PostgresAuthService");
const router = express_1.default.Router();
const postgresAuthService = new PostgresAuthService_1.PostgresAuthService();
router.post('/register', async (req, res) => {
    try {
        const userData = req.body;
        if (!userData.email || !userData.password || !userData.username) {
            return res.status(400).json({
                error: 'Email, username и password обязательны для заполнения'
            });
        }
        const result = await postgresAuthService.register(userData);
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        return res.status(400).json({
            error: error instanceof Error ? error.message : 'Ошибка при регистрации'
        });
    }
});
router.post('/login', async (req, res) => {
    try {
        const credentials = req.body;
        if (!credentials.email || !credentials.password) {
            return res.status(400).json({
                error: 'Email и password обязательны для заполнения'
            });
        }
        const result = await postgresAuthService.login(credentials);
        return res.status(200).json(result);
    }
    catch (error) {
        console.error('❌ Ошибка входа:', error);
        return res.status(401).json({
            error: error instanceof Error ? error.message : 'Ошибка при входе'
        });
    }
});
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
        const { passwordHash, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
    }
    catch (error) {
        console.error('❌ Ошибка получения пользователя:', error);
        return res.status(500).json({
            error: 'Ошибка при получении информации о пользователе'
        });
    }
});
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
    }
    catch (error) {
        console.error('❌ Ошибка проверки токена:', error);
        return res.status(500).json({
            valid: false,
            error: 'Ошибка при проверке токена'
        });
    }
});
exports.default = router;
//# sourceMappingURL=postgresAuthRoutes.js.map