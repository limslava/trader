"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BacktestingService = void 0;
const MemoryCacheService_1 = require("./MemoryCacheService");
class BacktestingService {
    constructor() {
        this.cacheService = new MemoryCacheService_1.MemoryCacheService();
    }
    async backtestRSIStrategy(config) {
        const cacheKey = `backtest_rsi_${config.symbol}_${config.timeframe}_${config.initialCapital}`;
        try {
            const cached = await this.cacheService.get(cacheKey);
            if (cached) {
                console.log(`📊 Бэктест RSI стратегии для ${config.symbol} загружен из кэша`);
                return cached;
            }
            const historicalData = await this.generateHistoricalData(config.symbol, config.timeframe);
            const result = await this.executeRSIBacktest(historicalData, config);
            this.cacheService.set(cacheKey, result, { ttl: 3600 });
            console.log(`✅ Бэктест RSI стратегии завершен: доходность ${result.totalReturn.toFixed(2)}%`);
            return result;
        }
        catch (error) {
            console.error('❌ Ошибка бэктестинга RSI стратегии:', error);
            throw new Error('Не удалось выполнить бэктестинг стратегии');
        }
    }
    async backtestMAStrategy(config) {
        const cacheKey = `backtest_ma_${config.symbol}_${config.timeframe}_${config.initialCapital}`;
        try {
            const cached = await this.cacheService.get(cacheKey);
            if (cached) {
                console.log(`📊 Бэктест MA стратегии для ${config.symbol} загружен из кэша`);
                return cached;
            }
            const historicalData = await this.generateHistoricalData(config.symbol, config.timeframe);
            const result = await this.executeMABacktest(historicalData, config);
            this.cacheService.set(cacheKey, result, { ttl: 3600 });
            console.log(`✅ Бэктест MA стратегии завершен: доходность ${result.totalReturn.toFixed(2)}%`);
            return result;
        }
        catch (error) {
            console.error('❌ Ошибка бэктестинга MA стратегии:', error);
            throw new Error('Не удалось выполнить бэктестинг стратегии');
        }
    }
    async compareStrategies(strategies, config) {
        const results = [];
        for (const strategy of strategies) {
            try {
                let result;
                switch (strategy) {
                    case 'RSI':
                        result = await this.backtestRSIStrategy(config);
                        break;
                    case 'MA':
                        result = await this.backtestMAStrategy(config);
                        break;
                    case 'MACD':
                        result = await this.backtestMACDStrategy(config);
                        break;
                    default:
                        throw new Error(`Неизвестная стратегия: ${strategy}`);
                }
                results.push({ strategy, result });
            }
            catch (error) {
                console.error(`❌ Ошибка бэктестинга стратегии ${strategy}:`, error);
            }
        }
        results.sort((a, b) => b.result.totalReturn - a.result.totalReturn);
        return results;
    }
    async executeRSIBacktest(historicalData, config) {
        const trades = [];
        let capital = config.initialCapital;
        let position = null;
        const equityCurve = [];
        for (let i = 50; i < historicalData.length; i++) {
            const currentData = historicalData[i];
            const previousData = historicalData[i - 1];
            const rsi = this.calculateRSI(historicalData.slice(i - 14, i + 1));
            if (!position) {
                if (rsi < config.rsiOversold) {
                    const riskAmount = capital * config.riskPerTrade;
                    const quantity = Math.floor(riskAmount / currentData.price);
                    if (quantity > 0) {
                        position = {
                            type: 'LONG',
                            entryPrice: currentData.price,
                            quantity,
                            entryDate: currentData.date
                        };
                        console.log(`📈 Вход в LONG: ${quantity} ${config.symbol} по ${currentData.price}`);
                    }
                }
            }
            else {
                const currentPnLPercent = (currentData.price - position.entryPrice) / position.entryPrice * 100;
                if (currentPnLPercent <= -config.stopLossPercent || currentPnLPercent >= config.takeProfitPercent) {
                    const trade = {
                        id: `trade_${trades.length + 1}`,
                        symbol: config.symbol,
                        type: position.type === 'LONG' ? 'BUY' : 'SELL',
                        entryPrice: position.entryPrice,
                        exitPrice: currentData.price,
                        quantity: position.quantity,
                        entryDate: position.entryDate,
                        exitDate: currentData.date,
                        pnl: (currentData.price - position.entryPrice) * position.quantity,
                        pnlPercent: currentPnLPercent,
                        duration: (currentData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
                    };
                    trades.push(trade);
                    capital += trade.pnl;
                    position = null;
                    console.log(`📉 Выход из позиции: PnL ${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
                }
                if (position && position.type === 'LONG' && rsi > config.rsiOverbought) {
                    const trade = {
                        id: `trade_${trades.length + 1}`,
                        symbol: config.symbol,
                        type: 'BUY',
                        entryPrice: position.entryPrice,
                        exitPrice: currentData.price,
                        quantity: position.quantity,
                        entryDate: position.entryDate,
                        exitDate: currentData.date,
                        pnl: (currentData.price - position.entryPrice) * position.quantity,
                        pnlPercent: (currentData.price - position.entryPrice) / position.entryPrice * 100,
                        duration: (currentData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
                    };
                    trades.push(trade);
                    capital += trade.pnl;
                    position = null;
                    console.log(`📊 Выход по RSI: PnL ${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
                }
            }
            const currentEquity = position
                ? capital + (currentData.price - position.entryPrice) * position.quantity
                : capital;
            equityCurve.push({
                date: currentData.date,
                equity: currentEquity
            });
        }
        if (position && historicalData.length > 0) {
            const lastData = historicalData[historicalData.length - 1];
            const trade = {
                id: `trade_${trades.length + 1}`,
                symbol: config.symbol,
                type: position.type === 'LONG' ? 'BUY' : 'SELL',
                entryPrice: position.entryPrice,
                exitPrice: lastData.price,
                quantity: position.quantity,
                entryDate: position.entryDate,
                exitDate: lastData.date,
                pnl: (lastData.price - position.entryPrice) * position.quantity,
                pnlPercent: (lastData.price - position.entryPrice) / position.entryPrice * 100,
                duration: (lastData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
            };
            trades.push(trade);
            capital += trade.pnl;
        }
        return this.calculateBacktestResult(trades, equityCurve, config);
    }
    async executeMABacktest(historicalData, config) {
        const trades = [];
        let capital = config.initialCapital;
        let position = null;
        const equityCurve = [];
        for (let i = config.movingAveragePeriod; i < historicalData.length; i++) {
            const currentData = historicalData[i];
            const ma = this.calculateMovingAverage(historicalData.slice(i - config.movingAveragePeriod, i + 1));
            if (!position) {
                if (currentData.price > ma) {
                    const riskAmount = capital * config.riskPerTrade;
                    const quantity = Math.floor(riskAmount / currentData.price);
                    if (quantity > 0) {
                        position = {
                            type: 'LONG',
                            entryPrice: currentData.price,
                            quantity,
                            entryDate: currentData.date
                        };
                    }
                }
            }
            else {
                const currentPnLPercent = (currentData.price - position.entryPrice) / position.entryPrice * 100;
                if (currentPnLPercent <= -config.stopLossPercent || currentPnLPercent >= config.takeProfitPercent) {
                    const trade = {
                        id: `trade_${trades.length + 1}`,
                        symbol: config.symbol,
                        type: 'BUY',
                        entryPrice: position.entryPrice,
                        exitPrice: currentData.price,
                        quantity: position.quantity,
                        entryDate: position.entryDate,
                        exitDate: currentData.date,
                        pnl: (currentData.price - position.entryPrice) * position.quantity,
                        pnlPercent: currentPnLPercent,
                        duration: (currentData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
                    };
                    trades.push(trade);
                    capital += trade.pnl;
                    position = null;
                }
                if (position && currentData.price < ma) {
                    const trade = {
                        id: `trade_${trades.length + 1}`,
                        symbol: config.symbol,
                        type: 'BUY',
                        entryPrice: position.entryPrice,
                        exitPrice: currentData.price,
                        quantity: position.quantity,
                        entryDate: position.entryDate,
                        exitDate: currentData.date,
                        pnl: (currentData.price - position.entryPrice) * position.quantity,
                        pnlPercent: (currentData.price - position.entryPrice) / position.entryPrice * 100,
                        duration: (currentData.date.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
                    };
                    trades.push(trade);
                    capital += trade.pnl;
                    position = null;
                }
            }
            const currentEquity = position
                ? capital + (currentData.price - position.entryPrice) * position.quantity
                : capital;
            equityCurve.push({
                date: currentData.date,
                equity: currentEquity
            });
        }
        return this.calculateBacktestResult(trades, equityCurve, config);
    }
    async backtestMACDStrategy(config) {
        return this.backtestRSIStrategy(config);
    }
    calculateBacktestResult(trades, equityCurve, config) {
        const totalReturn = ((equityCurve[equityCurve.length - 1]?.equity || config.initialCapital) - config.initialCapital) / config.initialCapital * 100;
        const profitableTrades = trades.filter(t => t.pnl > 0).length;
        const winRate = trades.length > 0 ? profitableTrades / trades.length * 100 : 0;
        let maxDrawdown = 0;
        let peak = config.initialCapital;
        for (const point of equityCurve) {
            if (point.equity > peak) {
                peak = point.equity;
            }
            const drawdown = (peak - point.equity) / peak * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        const returns = equityCurve.slice(1).map((point, i) => (point.equity - equityCurve[i].equity) / equityCurve[i].equity);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
        const sharpeRatio = volatility > 0 ? avgReturn / volatility * Math.sqrt(252) : 0;
        const days = (equityCurve[equityCurve.length - 1]?.date.getTime() - equityCurve[0]?.date.getTime()) / (1000 * 60 * 60 * 24);
        const annualizedReturn = days > 0 ? Math.pow(1 + totalReturn / 100, 365 / days) - 1 : 0;
        return {
            strategy: config.name,
            symbol: config.symbol,
            timeframe: config.timeframe,
            totalReturn,
            annualizedReturn: annualizedReturn * 100,
            maxDrawdown,
            sharpeRatio,
            winRate,
            totalTrades: trades.length,
            profitableTrades,
            startDate: equityCurve[0]?.date || new Date(),
            endDate: equityCurve[equityCurve.length - 1]?.date || new Date(),
            trades,
            equityCurve
        };
    }
    calculateRSI(prices) {
        if (prices.length < 15)
            return 50;
        let gains = 0;
        let losses = 0;
        for (let i = 1; i < 15; i++) {
            const change = prices[i].price - prices[i - 1].price;
            if (change > 0) {
                gains += change;
            }
            else {
                losses -= change;
            }
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    calculateMovingAverage(prices) {
        return prices.reduce((sum, data) => sum + data.price, 0) / prices.length;
    }
    async generateHistoricalData(symbol, timeframe) {
        const data = [];
        const basePrice = this.getBasePrice(symbol);
        let price = basePrice;
        const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        for (let i = 0; i < 365; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const volatility = 0.02;
            const change = (Math.random() - 0.5) * 2 * volatility;
            price = price * (1 + change);
            data.push({
                date,
                price,
                volume: Math.random() * 1000000 + 50000,
                high: price * (1 + Math.random() * 0.01),
                low: price * (1 - Math.random() * 0.01),
                open: price * (1 + (Math.random() - 0.5) * 0.005)
            });
        }
        return data;
    }
    getBasePrice(symbol) {
        const prices = {
            'SBER': 280.50,
            'GAZP': 162.30,
            'LKOH': 7480.25,
            'VTBR': 0.0248,
            'ROSN': 548.75,
            'BTCUSDT': 35420.50,
            'ETHUSDT': 1985.30
        };
        return prices[symbol] || 100;
    }
}
exports.BacktestingService = BacktestingService;
//# sourceMappingURL=BacktestingService.js.map