"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresPortfolioService = void 0;
const postgres_1 = require("../config/postgres");
const CapitalManagementService_1 = __importDefault(require("./CapitalManagementService"));
class PostgresPortfolioService {
    constructor() {
        this.capitalService = new CapitalManagementService_1.default();
    }
    async getUserPortfolio(userId) {
        try {
            const result = await postgres_1.postgresDatabase.query(`SELECT
          p.id, p.user_id, p.symbol, p.asset_type, p.quantity, p.average_price,
          p.current_price, p.total_value, p.profit_loss, p.profit_loss_percent,
          p.created_at, p.updated_at
         FROM portfolio p
         WHERE p.user_id = $1
         ORDER BY p.total_value DESC`, [userId]);
            return result.rows.map((row) => ({
                id: row.id,
                userId: row.user_id,
                assetId: row.symbol,
                symbol: row.symbol,
                assetType: row.asset_type?.toLowerCase() || 'stock',
                quantity: parseFloat(row.quantity),
                averagePrice: parseFloat(row.average_price),
                currentPrice: parseFloat(row.current_price),
                totalValue: parseFloat(row.total_value),
                profitLoss: parseFloat(row.profit_loss),
                profitLossPercentage: parseFloat(row.profit_loss_percent),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                assetSymbol: row.symbol,
                currentValue: parseFloat(row.total_value),
                totalCost: parseFloat(row.average_price) * parseFloat(row.quantity)
            }));
        }
        catch (error) {
            console.error('❌ Ошибка получения портфеля:', error);
            return [];
        }
    }
    async addToPortfolio(userId, assetId, symbol, quantity, price, type, assetType = 'stock', notes = '') {
        try {
            const client = await postgres_1.postgresDatabase.getPool().connect();
            try {
                await client.query('BEGIN');
                const existingPosition = await client.query('SELECT id, quantity, average_price FROM portfolio WHERE user_id = $1 AND symbol = $2', [userId, symbol]);
                const totalAmount = quantity * price;
                const fee = totalAmount * 0.001;
                if (existingPosition.rows.length > 0) {
                    const existing = existingPosition.rows[0];
                    if (type === 'BUY') {
                        const newQuantity = existing.quantity + quantity;
                        const newAveragePrice = ((existing.average_price * existing.quantity) + (price * quantity)) / newQuantity;
                        console.log('🔍 UPDATE portfolio values:', {
                            newQuantity,
                            newAveragePrice,
                            existingQuantity: existing.quantity,
                            existingAveragePrice: existing.average_price
                        });
                        await client.query(`UPDATE portfolio
               SET quantity = $1, average_price = $2, updated_at = NOW()
               WHERE id = $3`, [newQuantity, newAveragePrice, existing.id]);
                    }
                    else {
                        const newQuantity = existing.quantity - quantity;
                        if (newQuantity < 0) {
                            throw new Error('Недостаточно активов для продажи');
                        }
                        if (newQuantity === 0) {
                            await client.query('DELETE FROM portfolio WHERE id = $1', [existing.id]);
                        }
                        else {
                            await client.query(`UPDATE portfolio 
                 SET quantity = $1, updated_at = NOW()
                 WHERE id = $2`, [newQuantity, existing.id]);
                        }
                    }
                }
                else {
                    if (type === 'BUY') {
                        await client.query(`INSERT INTO portfolio
               (user_id, symbol, asset_type, quantity, average_price, current_price,
                total_value, profit_loss, profit_loss_percent, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`, [
                            userId, symbol, assetType.toUpperCase(),
                            parseFloat(quantity.toFixed(8)),
                            parseFloat(price.toFixed(8)),
                            parseFloat(price.toFixed(8)),
                            parseFloat((quantity * price).toFixed(8)),
                            0.00000000,
                            0.0000
                        ]);
                    }
                    else {
                        throw new Error('Невозможно продать актив, которого нет в портфеле');
                    }
                }
                await client.query(`INSERT INTO transactions
           (user_id, asset_symbol, asset_type, transaction_type, quantity, price, commission, total_amount, status, timestamp, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', NOW(), $9)`, [userId, symbol, assetType, type.toLowerCase(), quantity, price, fee, totalAmount, notes || '']);
                await client.query('COMMIT');
                return {
                    success: true,
                    message: type === 'BUY' ? 'Актив добавлен в портфель' : 'Актив продан из портфеля'
                };
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('❌ Ошибка добавления в портфель:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Ошибка при операции с портфелем'
            };
        }
    }
    async getUserTransactions(userId) {
        try {
            const result = await postgres_1.postgresDatabase.query(`SELECT
          id, user_id, asset_symbol, asset_type, transaction_type, quantity, price,
          total_amount, commission, timestamp, notes
         FROM transactions
         WHERE user_id = $1
         ORDER BY timestamp DESC
         LIMIT 50`, [userId]);
            return result.rows.map((row) => ({
                id: row.id,
                userId: row.user_id,
                assetId: row.asset_symbol,
                symbol: row.asset_symbol,
                type: row.transaction_type.toLowerCase(),
                quantity: parseFloat(row.quantity),
                price: parseFloat(row.price),
                totalAmount: parseFloat(row.total_amount),
                fee: parseFloat(row.commission || 0),
                timestamp: row.timestamp,
                status: 'completed',
                notes: row.notes || ''
            }));
        }
        catch (error) {
            console.error('❌ Ошибка получения транзакций:', error);
            return [];
        }
    }
    async updatePortfolioPrices() {
        try {
            console.log('📊 Обновление цен портфеля...');
            const portfolioResult = await postgres_1.postgresDatabase.query('SELECT id, symbol, asset_type FROM portfolio');
            if (portfolioResult.rows.length === 0) {
                console.log('📊 Нет позиций для обновления цен');
                return;
            }
            const marketDataService = new (await Promise.resolve().then(() => __importStar(require('./MarketDataService')))).MarketDataService();
            const symbols = portfolioResult.rows.map((row) => row.symbol);
            const prices = await marketDataService.getMultiplePrices(symbols);
            let updatedCount = 0;
            for (const row of portfolioResult.rows) {
                const symbol = row.symbol;
                const priceData = prices.get(symbol);
                if (priceData && priceData.price > 0) {
                    const currentPrice = priceData.price;
                    const quantity = parseFloat(row.quantity) || 0;
                    const averagePrice = parseFloat(row.average_price) || 0;
                    const totalValue = quantity * currentPrice;
                    const profitLoss = totalValue - (quantity * averagePrice);
                    const profitLossPercentage = averagePrice > 0 ? (profitLoss / (quantity * averagePrice)) * 100 : 0;
                    await postgres_1.postgresDatabase.query(`UPDATE portfolio
             SET current_price = $1, total_value = $2, profit_loss = $3, profit_loss_percent = $4, updated_at = NOW()
             WHERE id = $5`, [currentPrice, totalValue, profitLoss, profitLossPercentage, row.id]);
                    updatedCount++;
                }
            }
            console.log(`✅ Обновлены цены для ${updatedCount} позиций портфеля`);
        }
        catch (error) {
            console.error('❌ Ошибка обновления цен портфеля:', error);
        }
    }
    async getPortfolioSummary(userId) {
        try {
            const portfolioResult = await postgres_1.postgresDatabase.query(`SELECT
          COALESCE(SUM(total_value), 0) as total_value,
          COALESCE(SUM(profit_loss), 0) as total_profit_loss,
          COUNT(*) as asset_count
         FROM portfolio
         WHERE user_id = $1`, [userId]);
            const realizedPnLResult = await postgres_1.postgresDatabase.query(`WITH sell_transactions AS (
          SELECT
            asset_symbol,
            quantity,
            price,
            commission,
            timestamp,
            (SELECT SUM(quantity * price + commission) / SUM(quantity)
             FROM transactions t2
             WHERE t2.user_id = $1
               AND t2.asset_symbol = t1.asset_symbol
               AND t2.transaction_type = 'buy'
               AND t2.timestamp < t1.timestamp) as avg_buy_price_with_commission
          FROM transactions t1
          WHERE user_id = $1 AND transaction_type = 'sell'
        )
        SELECT
          SUM((price * quantity - commission) - (COALESCE(avg_buy_price_with_commission, 0) * quantity)) as realized_profit_loss
        FROM sell_transactions`, [userId]);
            const row = portfolioResult.rows[0];
            const totalValue = parseFloat(row.total_value) || 0;
            const unrealizedProfitLoss = parseFloat(row.total_profit_loss) || 0;
            const realizedProfitLoss = parseFloat(realizedPnLResult.rows[0]?.realized_profit_loss || 0);
            const totalProfitLoss = unrealizedProfitLoss + realizedProfitLoss;
            const totalProfitLossPercentage = totalValue > 0 ? (totalProfitLoss / totalValue) * 100 : 0;
            console.log('📊 Расчет прибыли/убытка:', {
                totalValue,
                unrealizedProfitLoss,
                realizedProfitLoss,
                totalProfitLoss,
                totalProfitLossPercentage
            });
            return {
                totalValue,
                totalProfitLoss,
                totalProfitLossPercentage,
                assetCount: parseInt(row.asset_count)
            };
        }
        catch (error) {
            console.error('❌ Ошибка получения сводки портфеля:', error);
            return {
                totalValue: 0,
                totalProfitLoss: 0,
                totalProfitLossPercentage: 0,
                assetCount: 0
            };
        }
    }
    async calculateCashBalance(userId) {
        try {
            const availableCapital = await this.capitalService.getAvailableCapital(userId);
            return Math.max(0, availableCapital);
        }
        catch (error) {
            console.error('❌ Ошибка расчета баланса наличных:', error);
            return 0;
        }
    }
}
exports.PostgresPortfolioService = PostgresPortfolioService;
exports.default = PostgresPortfolioService;
//# sourceMappingURL=PostgresPortfolioService.js.map