"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AuthService_1 = __importDefault(require("./AuthService"));
const globals_1 = require("@jest/globals");
(0, globals_1.describe)('AuthService', () => {
    let authService;
    (0, globals_1.beforeEach)(() => {
        authService = new AuthService_1.default();
    });
    (0, globals_1.describe)('register', () => {
        (0, globals_1.it)('should register a new user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
                profile: {
                    experienceLevel: 'BEGINNER',
                    riskTolerance: 'MEDIUM',
                    investmentGoals: ['Сбережения']
                }
            };
            const result = await authService.register(userData);
            (0, globals_1.expect)(result).toHaveProperty('user');
            (0, globals_1.expect)(result).toHaveProperty('token');
            (0, globals_1.expect)(result).toHaveProperty('refreshToken');
            (0, globals_1.expect)(result.user.email).toBe(userData.email);
            (0, globals_1.expect)(result.user.username).toBe(userData.username);
        });
        (0, globals_1.it)('should throw error for duplicate email', async () => {
            const userData = {
                email: 'demo@example.com',
                username: 'testuser2',
                password: 'password123',
                profile: {
                    experienceLevel: 'BEGINNER',
                    riskTolerance: 'MEDIUM',
                    investmentGoals: ['Сбережения']
                }
            };
            await (0, globals_1.expect)(authService.register(userData)).rejects.toThrow('Пользователь с таким email или именем уже существует');
        });
    });
    (0, globals_1.describe)('login', () => {
        (0, globals_1.it)('should login user successfully', async () => {
            const credentials = {
                email: 'demo@example.com',
                password: 'demo123'
            };
            const result = await authService.login(credentials);
            (0, globals_1.expect)(result).toHaveProperty('user');
            (0, globals_1.expect)(result).toHaveProperty('token');
            (0, globals_1.expect)(result).toHaveProperty('refreshToken');
            (0, globals_1.expect)(result.user.email).toBe(credentials.email);
        });
        (0, globals_1.it)('should throw error for invalid credentials', async () => {
            const credentials = {
                email: 'nonexistent@example.com',
                password: 'wrongpassword'
            };
            await (0, globals_1.expect)(authService.login(credentials)).rejects.toThrow('Неверный email или пароль');
        });
    });
    (0, globals_1.describe)('demoLogin', () => {
        (0, globals_1.it)('should login demo user successfully', async () => {
            const result = await authService.demoLogin();
            (0, globals_1.expect)(result).toHaveProperty('user');
            (0, globals_1.expect)(result).toHaveProperty('token');
            (0, globals_1.expect)(result).toHaveProperty('refreshToken');
            (0, globals_1.expect)(result.user.email).toBe('demo@example.com');
        });
    });
    (0, globals_1.describe)('token validation', () => {
        (0, globals_1.it)('should validate valid token', async () => {
            const result = await authService.demoLogin();
            const user = await authService.validateToken(result.token);
            (0, globals_1.expect)(user).toBeDefined();
            (0, globals_1.expect)(user?.id).toBe(result.user.id);
        });
        (0, globals_1.it)('should return null for invalid token', async () => {
            const user = await authService.validateToken('invalid-token');
            (0, globals_1.expect)(user).toBeNull();
        });
    });
    (0, globals_1.describe)('refresh token', () => {
        (0, globals_1.it)('should refresh token successfully', async () => {
            const result = await authService.demoLogin();
            const newTokens = await authService.refreshToken(result.refreshToken);
            (0, globals_1.expect)(newTokens).toHaveProperty('token');
            (0, globals_1.expect)(newTokens).toHaveProperty('refreshToken');
            (0, globals_1.expect)(newTokens.user.id).toBe(result.user.id);
        });
        (0, globals_1.it)('should throw error for invalid refresh token', async () => {
            await (0, globals_1.expect)(authService.refreshToken('invalid-refresh-token')).rejects.toThrow('Недействительный refresh token');
        });
    });
});
//# sourceMappingURL=AuthService.test.js.map