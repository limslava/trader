"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerIntegrationService = void 0;
class BrokerIntegrationService {
    constructor() {
        this.loadBrokerConfigurations();
    }
    loadBrokerConfigurations() {
        this.tinkoffConfig = {
            apiKey: process.env.TINKOFF_API_KEY || 'demo_key',
            accountId: process.env.TINKOFF_ACCOUNT_ID || 'demo_account',
            sandbox: true
        };
        this.sberInvestConfig = {
            token: process.env.SBER_INVEST_TOKEN || 'demo_token',
            accountId: process.env.SBER_INVEST_ACCOUNT_ID || 'demo_account'
        };
        this.vtbConfig = {
            login: process.env.VTB_LOGIN || 'demo_login',
            password: process.env.VTB_PASSWORD || 'demo_password',
            accountId: process.env.VTB_ACCOUNT_ID || 'demo_account'
        };
    }
    async getConnectedAccounts() {
        const accounts = [];
        if (this.tinkoffConfig) {
            accounts.push({
                id: 'tinkoff_1',
                brokerName: 'Тинькофф Инвестиции',
                accountNumber: this.tinkoffConfig.accountId,
                balance: 150000,
                currency: 'RUB',
                status: 'active'
            });
        }
        if (this.sberInvestConfig) {
            accounts.push({
                id: 'sber_1',
                brokerName: 'Сбербанк Инвестор',
                accountNumber: this.sberInvestConfig.accountId,
                balance: 200000,
                currency: 'RUB',
                status: 'active'
            });
        }
        if (this.vtbConfig) {
            accounts.push({
                id: 'vtb_1',
                brokerName: 'ВТБ Мои Инвестиции',
                accountNumber: this.vtbConfig.accountId,
                balance: 100000,
                currency: 'RUB',
                status: 'active'
            });
        }
        return accounts;
    }
    async getBrokerPositions(brokerAccountId) {
        const mockPositions = {
            'tinkoff_1': [
                {
                    symbol: 'SBER',
                    quantity: 100,
                    averagePrice: 250,
                    currentPrice: 280,
                    profitLoss: 3000,
                    profitLossPercent: 12.0
                },
                {
                    symbol: 'GAZP',
                    quantity: 50,
                    averagePrice: 160,
                    currentPrice: 155,
                    profitLoss: -250,
                    profitLossPercent: -3.1
                },
                {
                    symbol: 'LKOH',
                    quantity: 25,
                    averagePrice: 6500,
                    currentPrice: 6800,
                    profitLoss: 7500,
                    profitLossPercent: 4.6
                }
            ],
            'sber_1': [
                {
                    symbol: 'SBER',
                    quantity: 200,
                    averagePrice: 240,
                    currentPrice: 280,
                    profitLoss: 8000,
                    profitLossPercent: 16.7
                },
                {
                    symbol: 'VTBR',
                    quantity: 1000,
                    averagePrice: 0.025,
                    currentPrice: 0.027,
                    profitLoss: 2000,
                    profitLossPercent: 8.0
                }
            ],
            'vtb_1': [
                {
                    symbol: 'GAZP',
                    quantity: 100,
                    averagePrice: 158,
                    currentPrice: 155,
                    profitLoss: -300,
                    profitLossPercent: -1.9
                },
                {
                    symbol: 'ROSN',
                    quantity: 30,
                    averagePrice: 450,
                    currentPrice: 480,
                    profitLoss: 900,
                    profitLossPercent: 6.7
                }
            ]
        };
        return mockPositions[brokerAccountId] || [];
    }
    async placeOrder(brokerAccountId, symbol, type, quantity, price) {
        const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const currentPrice = this.getMockPrice(symbol);
        const order = {
            id: orderId,
            symbol,
            type,
            quantity,
            price: price || currentPrice,
            status: 'pending',
            timestamp: new Date(),
            brokerOrderId: `${brokerAccountId}_${orderId}`
        };
        setTimeout(() => {
            this.simulateOrderExecution(order);
        }, 2000);
        console.log(`Заявка размещена через брокера ${brokerAccountId}:`, {
            symbol,
            type,
            quantity,
            price: order.price
        });
        return order;
    }
    async cancelOrder(brokerAccountId, orderId) {
        console.log(`Заявка отменена: ${orderId} через брокера ${brokerAccountId}`);
        return true;
    }
    async getTradeHistory(brokerAccountId, days = 30) {
        const mockTrades = {
            'tinkoff_1': [
                {
                    id: 'trade_1',
                    symbol: 'SBER',
                    type: 'buy',
                    quantity: 50,
                    price: 250,
                    timestamp: new Date(Date.now() - 86400000),
                    commission: 25
                },
                {
                    id: 'trade_2',
                    symbol: 'GAZP',
                    type: 'sell',
                    quantity: 25,
                    price: 162,
                    timestamp: new Date(Date.now() - 172800000),
                    commission: 16
                }
            ],
            'sber_1': [
                {
                    id: 'trade_3',
                    symbol: 'VTBR',
                    type: 'buy',
                    quantity: 500,
                    price: 0.025,
                    timestamp: new Date(Date.now() - 259200000),
                    commission: 12.5
                }
            ]
        };
        return mockTrades[brokerAccountId] || [];
    }
    async getAvailableFunds(brokerAccountId) {
        const mockFunds = {
            'tinkoff_1': 50000,
            'sber_1': 75000,
            'vtb_1': 30000
        };
        return mockFunds[brokerAccountId] || 0;
    }
    async validateOrder(brokerAccountId, symbol, type, quantity, price) {
        const availableFunds = await this.getAvailableFunds(brokerAccountId);
        const currentPrice = price || this.getMockPrice(symbol);
        const totalCost = quantity * currentPrice;
        if (type === 'buy' && totalCost > availableFunds) {
            return {
                valid: false,
                message: `Недостаточно средств. Доступно: ${availableFunds} RUB, требуется: ${totalCost} RUB`,
                availableFunds
            };
        }
        if (quantity < 1) {
            return {
                valid: false,
                message: 'Минимальный лот: 1 акция'
            };
        }
        return {
            valid: true,
            availableFunds
        };
    }
    getMockPrice(symbol) {
        const mockPrices = {
            'SBER': 280,
            'GAZP': 155,
            'LKOH': 6800,
            'VTBR': 0.027,
            'ROSN': 480,
            'GMKN': 22000,
            'NLMK': 150,
            'PLZL': 12000,
            'TATN': 380,
            'MGNT': 5500
        };
        return mockPrices[symbol] || 100;
    }
    simulateOrderExecution(order) {
        order.status = 'executed';
        console.log(`Заявка исполнена: ${order.id}`, {
            symbol: order.symbol,
            type: order.type,
            quantity: order.quantity,
            price: order.price
        });
    }
    getBrokerCommissions(brokerAccountId) {
        const commissions = {
            'tinkoff_1': {
                stockCommission: 0.003,
                minCommission: 0,
                currency: 'RUB'
            },
            'sber_1': {
                stockCommission: 0.0035,
                minCommission: 35,
                currency: 'RUB'
            },
            'vtb_1': {
                stockCommission: 0.004,
                minCommission: 40,
                currency: 'RUB'
            }
        };
        return commissions[brokerAccountId] || {
            stockCommission: 0.003,
            minCommission: 0,
            currency: 'RUB'
        };
    }
}
exports.BrokerIntegrationService = BrokerIntegrationService;
exports.default = BrokerIntegrationService;
//# sourceMappingURL=BrokerIntegrationService.js.map