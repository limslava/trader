"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioService = void 0;
const MarketDataService_1 = require("./MarketDataService");
class PortfolioService {
    constructor() {
        this.marketDataService = new MarketDataService_1.MarketDataService();
    }
    async getPortfolio(userId) {
        try {
            const transactions = await this.getUserTransactions(userId);
            const positions = await this.calculatePortfolioPositions(userId, transactions);
            const portfolioSummary = await this.calculatePortfolioSummary(positions);
            return portfolioSummary;
        }
        catch (error) {
            console.error('Ошибка при получении портфеля:', error);
            throw new Error('Не удалось получить данные портфеля');
        }
    }
    async getUserTransactions(userId) {
        return this.getMockTransactions(userId);
    }
    async addTransaction(transactionData) {
        try {
            const totalAmount = transactionData.quantity * transactionData.price + (transactionData.commission || 0);
            return {
                ...transactionData,
                _id: `mock_${Date.now()}`,
                totalAmount,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }
        catch (error) {
            console.error('Ошибка при добавлении транзакции:', error);
            throw new Error('Не удалось добавить транзакцию');
        }
    }
    async calculatePortfolioPositions(userId, transactions) {
        const positions = {};
        for (const transaction of transactions) {
            const key = `${transaction.assetSymbol}_${transaction.assetType}`;
            if (!positions[key]) {
                positions[key] = {
                    assetSymbol: transaction.assetSymbol,
                    assetType: transaction.assetType,
                    quantity: 0,
                    averagePrice: 0,
                    currentPrice: 0,
                    totalCost: 0,
                    currentValue: 0,
                    profitLoss: 0,
                    profitLossPercentage: 0
                };
            }
            const position = positions[key];
            if (transaction.transactionType === 'buy') {
                const newTotalCost = position.totalCost + transaction.totalAmount;
                const newQuantity = position.quantity + transaction.quantity;
                position.quantity = newQuantity;
                position.averagePrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
                position.totalCost = newTotalCost;
            }
            else if (transaction.transactionType === 'sell') {
                position.quantity -= transaction.quantity;
                position.totalCost = position.averagePrice * position.quantity;
            }
        }
        const assetSymbols = Object.keys(positions);
        const symbols = assetSymbols.map(symbol => symbol.split('_')[0]).filter(Boolean);
        const currentPricesMap = await this.marketDataService.getMultiplePrices(symbols);
        const currentPrices = {};
        for (const [symbol, priceData] of currentPricesMap.entries()) {
            currentPrices[symbol] = priceData.price;
        }
        const result = [];
        for (const key in positions) {
            const position = positions[key];
            if (position) {
                const currentPrice = currentPrices[position.assetSymbol] || position.averagePrice;
                position.currentPrice = currentPrice;
                position.currentValue = position.quantity * currentPrice;
                position.profitLoss = position.currentValue - position.totalCost;
                position.profitLossPercentage = position.totalCost > 0 ? (position.profitLoss / position.totalCost) * 100 : 0;
                if (position.quantity > 0) {
                    result.push(position);
                }
            }
        }
        return result;
    }
    async calculatePortfolioSummary(positions) {
        const totalCost = positions.reduce((sum, position) => sum + position.totalCost, 0);
        const totalValue = positions.reduce((sum, position) => sum + position.currentValue, 0);
        const totalProfitLoss = totalValue - totalCost;
        const totalProfitLossPercentage = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
        return {
            totalValue,
            totalCost,
            totalProfitLoss,
            totalProfitLossPercentage,
            positions,
            cashBalance: 100000
        };
    }
    async getTransactionHistory(userId, limit = 50) {
        return this.getMockTransactions(userId).slice(0, limit);
    }
    getMockTransactions(userId) {
        const mockTransactions = [
            {
                _id: 'mock_1',
                userId,
                assetSymbol: 'SBER',
                assetType: 'stock',
                transactionType: 'buy',
                quantity: 10,
                price: 250,
                totalAmount: 2500,
                commission: 25,
                timestamp: new Date('2025-10-01'),
                status: 'completed',
                notes: 'Покупка Сбербанка',
                createdAt: new Date('2025-10-01'),
                updatedAt: new Date('2025-10-01')
            },
            {
                _id: 'mock_2',
                userId,
                assetSymbol: 'GAZP',
                assetType: 'stock',
                transactionType: 'buy',
                quantity: 5,
                price: 180,
                totalAmount: 900,
                commission: 9,
                timestamp: new Date('2025-10-05'),
                status: 'completed',
                notes: 'Покупка Газпрома',
                createdAt: new Date('2025-10-05'),
                updatedAt: new Date('2025-10-05')
            },
            {
                _id: 'mock_3',
                userId,
                assetSymbol: 'BTCUSDT',
                assetType: 'crypto',
                transactionType: 'buy',
                quantity: 0.01,
                price: 45000,
                totalAmount: 450,
                commission: 4.5,
                timestamp: new Date('2025-10-10'),
                status: 'completed',
                notes: 'Покупка Bitcoin',
                createdAt: new Date('2025-10-10'),
                updatedAt: new Date('2025-10-10')
            }
        ];
        return mockTransactions;
    }
    async getPortfolioStats(userId) {
        const portfolio = await this.getPortfolio(userId);
        const transactions = await this.getTransactionHistory(userId);
        return {
            portfolio,
            transactionCount: transactions.length,
            totalTrades: transactions.filter(t => t.status === 'completed').length,
            winningTrades: transactions.filter(t => t.status === 'completed' &&
                ((t.transactionType === 'buy' && t.price < (portfolio.positions.find(p => p.assetSymbol === t.assetSymbol)?.currentPrice || 0)) ||
                    (t.transactionType === 'sell' && t.price > (portfolio.positions.find(p => p.assetSymbol === t.assetSymbol)?.averagePrice || 0)))).length
        };
    }
}
exports.PortfolioService = PortfolioService;
//# sourceMappingURL=PortfolioService.js.map