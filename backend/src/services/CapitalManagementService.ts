import { postgresDatabase } from '../config/postgres';

export interface UserCapital {
  id: string;
  userId: string;
  initialCapital: number;
  currentCapital: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CapitalManagementService {
  /**
   * Получить информацию о капитале пользователя
   */
  async getUserCapital(userId: string): Promise<UserCapital | null> {
    try {
      const result = await postgresDatabase.query(
        `SELECT 
          id, user_id, initial_capital, current_capital, created_at, updated_at
         FROM user_capital 
         WHERE user_id = $1`,
        [userId]
      );

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
    } catch (error) {
      console.error('❌ Ошибка получения капитала пользователя:', error);
      return null;
    }
  }

  /**
   * Установить стартовый капитал
   */
  async setInitialCapital(userId: string, amount: number): Promise<{ success: boolean; message: string }> {
    try {
      // Проверяем существующую запись
      const existingCapital = await this.getUserCapital(userId);
      
      if (existingCapital) {
        // Обновляем существующую запись
        await postgresDatabase.query(
          `UPDATE user_capital 
           SET initial_capital = $1, current_capital = $1, updated_at = NOW()
           WHERE user_id = $2`,
          [amount, userId]
        );
      } else {
        // Создаем новую запись
        await postgresDatabase.query(
          `INSERT INTO user_capital (user_id, initial_capital, current_capital)
           VALUES ($1, $2, $2)`,
          [userId, amount]
        );
      }

      return {
        success: true,
        message: `Стартовый капитал установлен: ${amount.toFixed(2)} ₽`
      };
    } catch (error) {
      console.error('❌ Ошибка установки стартового капитала:', error);
      return {
        success: false,
        message: 'Не удалось установить стартовый капитал'
      };
    }
  }

  /**
   * Пополнить счет
   */
  async deposit(userId: string, amount: number): Promise<{ success: boolean; message: string; newBalance: number }> {
    try {
      const client = await postgresDatabase.getPool().connect();
      
      try {
        await client.query('BEGIN');

        // Получаем текущий капитал
        const capitalResult = await client.query(
          'SELECT current_capital FROM user_capital WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        let newBalance: number;

        if (capitalResult.rows.length === 0) {
          // Создаем запись с пополнением
          await client.query(
            'INSERT INTO user_capital (user_id, initial_capital, current_capital) VALUES ($1, $2, $2)',
            [userId, amount]
          );
          newBalance = amount;
        } else {
          // Обновляем существующую запись
          const currentBalance = parseFloat(capitalResult.rows[0].current_capital);
          newBalance = currentBalance + amount;
          
          await client.query(
            'UPDATE user_capital SET current_capital = $1, updated_at = NOW() WHERE user_id = $2',
            [newBalance, userId]
          );
        }

        // Записываем транзакцию пополнения
        await client.query(
          `INSERT INTO transactions 
           (user_id, symbol, asset_type, transaction_type, quantity, price, commission, total_amount, status, timestamp, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
          [
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
          ]
        );

        await client.query('COMMIT');

        return {
          success: true,
          message: `Счет пополнен на ${amount.toFixed(2)} ₽`,
          newBalance
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Ошибка пополнения счета:', error);
      return {
        success: false,
        message: 'Не удалось пополнить счет',
        newBalance: 0
      };
    }
  }

  /**
   * Вывести средства
   */
  async withdraw(userId: string, amount: number): Promise<{ success: boolean; message: string; newBalance: number }> {
    try {
      const client = await postgresDatabase.getPool().connect();
      
      try {
        await client.query('BEGIN');

        // Получаем текущий капитал
        const capitalResult = await client.query(
          'SELECT current_capital FROM user_capital WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (capitalResult.rows.length === 0) {
          throw new Error('Недостаточно средств для вывода');
        }

        const currentBalance = parseFloat(capitalResult.rows[0].current_capital);
        
        if (currentBalance < amount) {
          throw new Error('Недостаточно средств для вывода');
        }

        const newBalance = currentBalance - amount;
        
        // Обновляем баланс
        await client.query(
          'UPDATE user_capital SET current_capital = $1, updated_at = NOW() WHERE user_id = $2',
          [newBalance, userId]
        );

        // Записываем транзакцию вывода
        await client.query(
          `INSERT INTO transactions 
           (user_id, symbol, asset_type, transaction_type, quantity, price, commission, total_amount, status, timestamp, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)`,
          [
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
          ]
        );

        await client.query('COMMIT');

        return {
          success: true,
          message: `Средства выведены: ${amount.toFixed(2)} ₽`,
          newBalance
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Ошибка вывода средств:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Не удалось вывести средства',
        newBalance: 0
      };
    }
  }

  /**
   * Рассчитать доступные средства для торговли
   */
  async getAvailableCapital(userId: string): Promise<number> {
    try {
      const capital = await this.getUserCapital(userId);
      
      if (!capital) {
        return 0;
      }

      // Получаем сумму всех открытых позиций
      const portfolioResult = await postgresDatabase.query(
        'SELECT COALESCE(SUM(total_value), 0) as total_invested FROM portfolio WHERE user_id = $1',
        [userId]
      );

      const totalInvested = parseFloat(portfolioResult.rows[0].total_invested);
      const available = capital.currentCapital - totalInvested;

      return Math.max(0, available); // Не может быть отрицательным
    } catch (error) {
      console.error('❌ Ошибка расчета доступных средств:', error);
      return 0;
    }
  }

  /**
   * Инициализировать капитал для существующих пользователей
   */
  async initializeUserCapital(userId: string): Promise<void> {
    try {
      const existing = await this.getUserCapital(userId);
      
      if (!existing) {
        await postgresDatabase.query(
          'INSERT INTO user_capital (user_id, initial_capital, current_capital) VALUES ($1, 0, 0)',
          [userId]
        );
        console.log(`✅ Капитал инициализирован для пользователя ${userId}`);
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации капитала:', error);
    }
  }
}

export default CapitalManagementService;