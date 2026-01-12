"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresAuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const postgres_1 = require("../config/postgres");
class PostgresAuthService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'russian-trader-secret-key-2025';
    }
    async register(userData) {
        try {
            const existingUser = await postgres_1.postgresDatabase.query('SELECT id FROM users WHERE email = $1', [userData.email]);
            if (existingUser.rows.length > 0) {
                throw new Error('Пользователь с таким email уже существует');
            }
            const hashedPassword = await bcryptjs_1.default.hash(userData.password, 12);
            const defaultProfile = {
                firstName: userData.profile?.firstName || '',
                lastName: userData.profile?.lastName || '',
                experienceLevel: 'BEGINNER',
                riskTolerance: 'MEDIUM',
                investmentGoals: ['Обучение', 'Рост капитала']
            };
            const defaultPreferences = {
                notifications: {
                    email: true,
                    push: true,
                    priceAlerts: true,
                    riskAlerts: true
                },
                theme: 'LIGHT',
                language: 'RU',
                currency: 'RUB',
                defaultExchange: 'MOEX'
            };
            const result = await postgres_1.postgresDatabase.query(`INSERT INTO users (email, username, password_hash, profile, preferences, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, email, username, profile, preferences, created_at, updated_at`, [
                userData.email,
                userData.username,
                hashedPassword,
                JSON.stringify(defaultProfile),
                JSON.stringify(defaultPreferences)
            ]);
            const newUser = result.rows[0];
            const token = jsonwebtoken_1.default.sign({
                userId: newUser.id,
                email: newUser.email,
                username: newUser.username
            }, this.jwtSecret, { expiresIn: '24h' });
            const refreshToken = jsonwebtoken_1.default.sign({ userId: newUser.id }, this.jwtSecret + '-refresh', { expiresIn: '7d' });
            return {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    username: newUser.username,
                    profile: newUser.profile,
                    preferences: newUser.preferences,
                    createdAt: newUser.created_at,
                    updatedAt: newUser.updated_at
                },
                token,
                refreshToken
            };
        }
        catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            throw error;
        }
    }
    async login(credentials) {
        try {
            const result = await postgres_1.postgresDatabase.query('SELECT id, email, username, password_hash, profile, preferences, created_at, updated_at FROM users WHERE email = $1', [credentials.email]);
            if (result.rows.length === 0) {
                throw new Error('Пользователь не найден');
            }
            const user = result.rows[0];
            const isPasswordValid = await bcryptjs_1.default.compare(credentials.password, user.password_hash);
            if (!isPasswordValid) {
                throw new Error('Неверный пароль');
            }
            const token = jsonwebtoken_1.default.sign({
                userId: user.id,
                email: user.email,
                username: user.username
            }, this.jwtSecret, { expiresIn: '24h' });
            const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, this.jwtSecret + '-refresh', { expiresIn: '7d' });
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    profile: user.profile,
                    preferences: user.preferences,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                },
                token,
                refreshToken
            };
        }
        catch (error) {
            console.error('❌ Ошибка входа:', error);
            throw error;
        }
    }
    async getUserById(userId) {
        try {
            const result = await postgres_1.postgresDatabase.query('SELECT id, email, username, profile, preferences, created_at, updated_at FROM users WHERE id = $1', [userId]);
            if (result.rows.length === 0) {
                return null;
            }
            const user = result.rows[0];
            return {
                id: user.id,
                email: user.email,
                username: user.username,
                passwordHash: user.password_hash,
                profile: user.profile,
                preferences: user.preferences,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            };
        }
        catch (error) {
            console.error('❌ Ошибка получения пользователя:', error);
            return null;
        }
    }
    async verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            return decoded;
        }
        catch (error) {
            console.error('❌ Ошибка верификации токена:', error);
            return null;
        }
    }
    async initializeTestUser() {
        try {
            const existingUser = await postgres_1.postgresDatabase.query('SELECT id FROM users WHERE email = $1', ['2720233@gmail.com']);
            if (existingUser.rows.length === 0) {
                const hashedPassword = await bcryptjs_1.default.hash('test123', 12);
                const defaultProfile = {
                    firstName: 'Тестовый',
                    lastName: 'Пользователь',
                    experienceLevel: 'BEGINNER',
                    riskTolerance: 'MEDIUM',
                    investmentGoals: ['Обучение', 'Рост капитала']
                };
                const defaultPreferences = {
                    notifications: {
                        email: true,
                        push: true,
                        priceAlerts: true,
                        riskAlerts: true
                    },
                    theme: 'LIGHT',
                    language: 'RU',
                    currency: 'RUB',
                    defaultExchange: 'MOEX'
                };
                await postgres_1.postgresDatabase.query(`INSERT INTO users (email, username, password_hash, profile, preferences, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`, [
                    '2720233@gmail.com',
                    'test_user',
                    hashedPassword,
                    JSON.stringify(defaultProfile),
                    JSON.stringify(defaultPreferences)
                ]);
                console.log('✅ Тестовый пользователь создан');
            }
            else {
                console.log('✅ Тестовый пользователь уже существует');
            }
        }
        catch (error) {
            console.error('❌ Ошибка инициализации тестового пользователя:', error);
        }
    }
}
exports.PostgresAuthService = PostgresAuthService;
exports.default = PostgresAuthService;
//# sourceMappingURL=PostgresAuthService.js.map