"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PostgresPortfolioService_1 = require("../services/PostgresPortfolioService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const portfolioService = new PostgresPortfolioService_1.PostgresPortfolioService();
router.get('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const positions = await portfolioService.getUserPortfolio(userId);
        const summary = await portfolioService.getPortfolioSummary(userId);
        const cashBalance = await portfolioService.calculateCashBalance(userId);
        const portfolio = {
            totalValue: summary.totalValue,
            totalCost: summary.totalValue - summary.totalProfitLoss,
            totalProfitLoss: summary.totalProfitLoss,
            totalProfitLossPercentage: summary.totalProfitLossPercentage,
            positions: positions,
            cashBalance: cashBalance,
            assetCount: summary.assetCount
        };
        res.json({
            success: true,
            data: portfolio
        });
    }
    catch (error) {
        console.error('Ошибка получения портфеля:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить данные портфеля'
        });
    }
});
router.get('/transactions', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 50;
        const transactions = await portfolioService.getUserTransactions(userId);
        res.json({
            success: true,
            data: transactions
        });
    }
    catch (error) {
        console.error('Ошибка получения истории транзакций:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить историю транзакций'
        });
    }
});
router.post('/transactions', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { assetSymbol, assetType, transactionType, quantity, price, commission = 0, notes } = req.body;
        if (!assetSymbol || !assetType || !transactionType || !quantity || !price) {
            res.status(400).json({
                success: false,
                message: 'Необходимо указать все обязательные поля: assetSymbol, assetType, transactionType, quantity, price'
            });
            return;
        }
        if (!['stock', 'crypto', 'currency'].includes(assetType)) {
            res.status(400).json({
                success: false,
                message: 'Некорректный тип актива. Допустимые значения: stock, crypto, currency'
            });
            return;
        }
        if (!['buy', 'sell'].includes(transactionType)) {
            res.status(400).json({
                success: false,
                message: 'Некорректный тип транзакции. Допустимые значения: buy, sell'
            });
            return;
        }
        if (quantity <= 0) {
            res.status(400).json({
                success: false,
                message: 'Количество должно быть больше 0'
            });
            return;
        }
        if (price <= 0) {
            res.status(400).json({
                success: false,
                message: 'Цена должна быть больше 0'
            });
            return;
        }
        const transactionData = {
            userId,
            assetSymbol,
            assetType,
            transactionType,
            quantity,
            price,
            commission,
            timestamp: new Date(),
            status: 'completed',
            notes
        };
        const result = await portfolioService.addToPortfolio(userId, assetSymbol, assetSymbol, quantity, price, transactionType.toUpperCase(), assetType.toLowerCase(), notes);
        if (!result.success) {
            res.status(400).json({
                success: false,
                message: result.message
            });
            return;
        }
        const transactions = await portfolioService.getUserTransactions(userId);
        const latestTransaction = transactions[0];
        res.status(201).json({
            success: true,
            message: result.message,
            data: latestTransaction
        });
    }
    catch (error) {
        console.error('Ошибка добавления транзакции:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось добавить транзакцию'
        });
    }
});
router.get('/stats', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const stats = await portfolioService.getPortfolioSummary(userId);
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Ошибка получения статистики портфеля:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить статистику портфеля'
        });
    }
});
router.delete('/transactions/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Функция удаления транзакций доступна только при подключенной базе данных'
        });
    }
    catch (error) {
        console.error('Ошибка удаления транзакции:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось удалить транзакцию'
        });
    }
});
router.post('/update-prices', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        await portfolioService.updatePortfolioPrices();
        res.json({
            success: true,
            message: 'Цены портфеля успешно обновлены с актуальными котировками'
        });
    }
    catch (error) {
        console.error('Ошибка обновления цен портфеля:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось обновить цены портфеля'
        });
    }
});
exports.default = router;
//# sourceMappingURL=portfolioRoutes.js.map