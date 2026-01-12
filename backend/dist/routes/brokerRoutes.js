"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const BrokerIntegrationService_1 = require("../services/BrokerIntegrationService");
const router = express_1.default.Router();
const brokerService = new BrokerIntegrationService_1.BrokerIntegrationService();
router.get('/accounts', async (req, res) => {
    try {
        const accounts = await brokerService.getConnectedAccounts();
        res.json({
            success: true,
            data: accounts
        });
    }
    catch (error) {
        console.error('Ошибка получения брокерских счетов:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось получить список брокерских счетов'
        });
    }
});
router.get('/accounts/:accountId/positions', async (req, res) => {
    try {
        const { accountId } = req.params;
        const positions = await brokerService.getBrokerPositions(accountId);
        res.json({
            success: true,
            data: positions
        });
    }
    catch (error) {
        console.error('Ошибка получения позиций брокера:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось получить позиции брокера'
        });
    }
});
router.post('/accounts/:accountId/orders', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { symbol, type, quantity, price } = req.body;
        if (!symbol || !type || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'Обязательные поля: symbol, type, quantity'
            });
        }
        if (type !== 'buy' && type !== 'sell') {
            return res.status(400).json({
                success: false,
                error: 'Тип заявки должен быть "buy" или "sell"'
            });
        }
        if (quantity <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Количество должно быть положительным числом'
            });
        }
        const validation = await brokerService.validateOrder(accountId, symbol, type, quantity, price);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.message,
                availableFunds: validation.availableFunds
            });
        }
        const order = await brokerService.placeOrder(accountId, symbol, type, quantity, price);
        return res.json({
            success: true,
            message: 'Заявка успешно размещена',
            data: order
        });
    }
    catch (error) {
        console.error('Ошибка размещения заявки:', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось разместить заявку'
        });
    }
});
router.delete('/accounts/:accountId/orders/:orderId', async (req, res) => {
    try {
        const { accountId, orderId } = req.params;
        const success = await brokerService.cancelOrder(accountId, orderId);
        if (success) {
            res.json({
                success: true,
                message: 'Заявка успешно отменена'
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Не удалось отменить заявку'
            });
        }
    }
    catch (error) {
        console.error('Ошибка отмены заявки:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось отменить заявку'
        });
    }
});
router.get('/accounts/:accountId/trades', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { days = 30 } = req.query;
        const trades = await brokerService.getTradeHistory(accountId, parseInt(days));
        res.json({
            success: true,
            data: trades
        });
    }
    catch (error) {
        console.error('Ошибка получения истории сделок:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось получить историю сделок'
        });
    }
});
router.get('/accounts/:accountId/funds', async (req, res) => {
    try {
        const { accountId } = req.params;
        const availableFunds = await brokerService.getAvailableFunds(accountId);
        res.json({
            success: true,
            data: {
                availableFunds,
                currency: 'RUB'
            }
        });
    }
    catch (error) {
        console.error('Ошибка получения доступных средств:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось получить доступные средства'
        });
    }
});
router.post('/accounts/:accountId/validate-order', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { symbol, type, quantity, price } = req.body;
        if (!symbol || !type || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'Обязательные поля: symbol, type, quantity'
            });
        }
        const validation = await brokerService.validateOrder(accountId, symbol, type, quantity, price);
        return res.json({
            success: true,
            data: validation
        });
    }
    catch (error) {
        console.error('Ошибка валидации заявки:', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось проверить заявку'
        });
    }
});
router.get('/accounts/:accountId/commissions', async (req, res) => {
    try {
        const { accountId } = req.params;
        const commissions = brokerService.getBrokerCommissions(accountId);
        res.json({
            success: true,
            data: commissions
        });
    }
    catch (error) {
        console.error('Ошибка получения комиссий:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось получить информацию о комиссиях'
        });
    }
});
router.get('/supported-brokers', (req, res) => {
    const supportedBrokers = [
        {
            id: 'tinkoff',
            name: 'Тинькофф Инвестиции',
            description: 'Один из крупнейших российских брокеров',
            features: [
                'Торговля на MOEX и СПБирже',
                'Низкие комиссии',
                'Удобное мобильное приложение',
                'Инвестиционные идеи'
            ],
            commission: '0.3%',
            minCommission: '0 руб',
            supportedAssets: ['Акции', 'Облигации', 'ETF', 'Валюта']
        },
        {
            id: 'sber',
            name: 'Сбербанк Инвестор',
            description: 'Брокер от крупнейшего банка России',
            features: [
                'Интеграция с банковским счетом',
                'Профессиональная аналитика',
                'Образовательные материалы',
                'Персональный менеджер'
            ],
            commission: '0.35%',
            minCommission: '35 руб',
            supportedAssets: ['Акции', 'Облигации', 'ETF', 'Структурные продукты']
        },
        {
            id: 'vtb',
            name: 'ВТБ Мои Инвестиции',
            description: 'Брокерские услуги от ВТБ',
            features: [
                'Доступ к IPO',
                'Инвестиционные стратегии',
                'Аналитика рынка',
                'Клиентская поддержка 24/7'
            ],
            commission: '0.4%',
            minCommission: '40 руб',
            supportedAssets: ['Акции', 'Облигации', 'Валютные пары', 'Драгоценные металлы']
        }
    ];
    res.json({
        success: true,
        data: supportedBrokers
    });
});
exports.default = router;
//# sourceMappingURL=brokerRoutes.js.map