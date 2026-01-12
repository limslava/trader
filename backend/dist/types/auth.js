"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockUsers = void 0;
exports.mockUsers = [
    {
        id: '1',
        email: 'demo@russian-trader.ru',
        username: 'demo_trader',
        passwordHash: '$2b$10$examplehash',
        profile: {
            firstName: 'Демо',
            lastName: 'Трейдер',
            experienceLevel: 'BEGINNER',
            riskTolerance: 'MEDIUM',
            investmentGoals: ['Обучение', 'Пассивный доход', 'Рост капитала']
        },
        preferences: {
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
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        lastLoginAt: new Date()
    }
];
//# sourceMappingURL=auth.js.map