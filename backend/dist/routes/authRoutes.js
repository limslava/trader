"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PostgresAuthService_1 = require("../services/PostgresAuthService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const postgresAuthService = new PostgresAuthService_1.PostgresAuthService();
router.post('/register', async (req, res) => {
    try {
        const userData = req.body;
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
    }
    catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : 'Ошибка регистрации'
        });
    }
});
router.post('/login', async (req, res) => {
    try {
        const loginData = req.body;
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
    }
    catch (error) {
        console.error('Ошибка входа:', error);
        res.status(401).json({
            success: false,
            message: error instanceof Error ? error.message : 'Ошибка входа'
        });
    }
});
router.post('/demo-login', async (_req, res) => {
    try {
        const result = await postgresAuthService.login({
            email: '2720233@gmail.com',
            password: 'test123'
        });
        res.json({
            success: true,
            message: 'Демо-вход выполнен успешно',
            data: result
        });
    }
    catch (error) {
        console.error('Ошибка демо-входа:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка демо-входа'
        });
    }
});
router.get('/profile', authMiddleware_1.authenticateToken, async (req, res) => {
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
        const { passwordHash, ...userWithoutPassword } = user;
        res.json({
            success: true,
            data: userWithoutPassword
        });
    }
    catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения профиля'
        });
    }
});
router.post('/logout', authMiddleware_1.authenticateToken, async (_req, res) => {
    try {
        res.json({
            success: true,
            message: 'Выход выполнен успешно'
        });
    }
    catch (error) {
        console.error('Ошибка выхода:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка выхода'
        });
    }
});
router.get('/verify', authMiddleware_1.authenticateToken, async (req, res) => {
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
        const { passwordHash, ...userWithoutPassword } = user;
        res.json({
            success: true,
            message: 'Токен действителен',
            data: userWithoutPassword
        });
    }
    catch (error) {
        console.error('Ошибка проверки токена:', error);
        res.status(401).json({
            success: false,
            message: 'Недействительный токен'
        });
    }
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map