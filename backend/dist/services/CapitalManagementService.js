"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapitalManagementService = void 0;
const postgres_1 = require("../config/postgres");
class CapitalManagementService {
    async getUserCapital(userId) {
        try {
            const result = await postgres_1.postgresDatabase.query(`SELECT 
          id, user_id, initial_capital, current_capital, created_at, updated_at
         FROM user_capital 
         WHERE user_id = $1`, [userId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                id: row.id,
                userId: row.user_id,
                initialCapital: parseFloat(row.initial_capital),
                currentCapital: parseFloat(row.current_capital),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        }
        catch (error) {
            console.error('❌ Ошибка получения капитала пользователя:', error);
            return null;
        }
    }
    async setInitialCapital(userId, amount) {
        try {
            const existingCapital = await this.getUserCapital(userId);
            if (existingCapital) {
                await postgres_1.postgresDatabase.query(`UPDATE user_capital 
           SET initial_capital = $1, current_capital = $1, updated_at = NOW()
           WHERE user_id = $2`, [amount, userId]);
            }
            else {
                await postgres_1.postgresDatabase.query(`INSERT INTO user_capital (user_id, initial_capital, current_capital)
           VALUES ($1, $2, $2)`, [userId, amount]);
            }
            return {
                success: true,
                message: `Стартовый капитал установлен: ${amount.toFixed(2)} ₽`
            };
        }
        catch (error) {
            console.error('❌ Ошибка установки стартового капитала:', error);
            return {
                success: false,
                message: 'Не удалось установить стартовый капитал'
            };
        }
    }
    async deposit(userId, amount) {
        try {
            const client = await postgres_1.postgresDatabase.getPool().connect();
            try {
                await client.query('BEGIN');
                const capitalResult = await client.query('SELECT current_capital FROM user_capital WHERE user_id = $1 FOR UPDATE', [userId]);
                let newBalance;
                if (capitalResult.rows.length === 0) {
                    await client.query('INSERT INTO user_capital (user_id, initial_capital, current_capital) VALUES ($1, $2, $2)', [userId, amount]);
                    newBalance = amount;
                }
                else {
                    const currentBalance = parseFloat(capitalResult.rows[0].current_capital);
                    newBalance = currentBalance + amount;
                    await client.query('UPDATE user_capital SET current_capital = $1, updated_at = NOW() WHERE user_id = $2', [newBalance, userId]);
                }
                await client.query(`INSERT INTO transactions 
           (user_id, symbol, asset_type, transaction_type, quantity, price, commission, total_amount, status, timestamp, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`, [
                    userId,
                    'CASH',
                    'CURRENCY',
                    'deposit',
                    1,
                    amount,
                    0,
                    amount,
                    'completed',
                    `Пополнение счета на ${amount.toFixed(2)} ₽`
                ]);
                await client.query('COMMIT');
                return {
                    success: true,
                    message: `Счет пополнен на ${amount.toFixed(2)} ₽`,
                    newBalance
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
            console.error('❌ Ошибка пополнения счета:', error);
            return {
                success: false,
                message: 'Не удалось пополнить счет',
                newBalance: 0
            };
        }
    }
    async withdraw(userId, amount) {
        try {
            const client = await postgres_1.postgresDatabase.getPool().connect();
            try {
                await client.query('BEGIN');
                const capitalResult = await client.query('SELECT current_capital FROM user_capital WHERE user_id = $1 FOR UPDATE', [userId]);
                if (capitalResult.rows.length === 0) {
                    throw new Error('Недостаточно средств для вывода');
                }
                const currentBalance = parseFloat(capitalResult.rows[0].current_capital);
                if (currentBalance < amount) {
                    throw new Error('Недостаточно средств для вывода');
                }
                const newBalance = currentBalance - amount;
                await client.query('UPDATE user_capital SET current_capital = $1, updated_at = NOW() WHERE user_id = $2', [newBalance, userId]);
                await client.query(`INSERT INTO transactions 
           (user_id, symbol, asset_type, transaction_type, quantity, price, commission, total_amount, status, timestamp, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`, [
                    userId,
                    'CASH',
                    'CURRENCY',
                    'withdraw',
                    1,
                    amount,
                    0,
                    amount,
                    'completed',
                    `Вывод средств на ${amount.toFixed(2)} ₽`
                ]);
                await client.query('COMMIT');
                return {
                    success: true,
                    message: `Средства выведены: ${amount.toFixed(2)} ₽`,
                    newBalance
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
            console.error('❌ Ошибка вывода средств:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Не удалось вывести средства',
                newBalance: 0
            };
        }
    }
    async getAvailableCapital(userId) {
        try {
            const capital = await this.getUserCapital(userId);
            if (!capital) {
                return 0;
            }
            const portfolioResult = await postgres_1.postgresDatabase.query('SELECT COALESCE(SUM(total_value), 0) as total_invested FROM portfolio WHERE user_id = $1', [userId]);
            const totalInvested = parseFloat(portfolioResult.rows[0].total_invested);
            const available = capital.currentCapital - totalInvested;
            return Math.max(0, available);
        }
        catch (error) {
            console.error('❌ Ошибка расчета доступных средств:', error);
            return 0;
        }
    }
    async initializeUserCapital(userId) {
        try {
            const existing = await this.getUserCapital(userId);
            if (!existing) {
                await postgres_1.postgresDatabase.query('INSERT INTO user_capital (user_id, initial_capital, current_capital) VALUES ($1, 0, 0)', [userId]);
                console.log(`✅ Капитал инициализирован для пользователя ${userId}`);
            }
        }
        catch (error) {
            console.error('❌ Ошибка инициализации капитала:', error);
        }
    }
}
exports.CapitalManagementService = CapitalManagementService;
exports.default = CapitalManagementService;
//# sourceMappingURL=CapitalManagementService.js.map