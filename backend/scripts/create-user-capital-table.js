const { postgresDatabase } = require('./src/config/postgres');

async function createUserCapitalTable() {
  try {
    console.log('📊 Создание таблицы user_capital...');
    
    await postgresDatabase.query(`
      CREATE TABLE IF NOT EXISTS user_capital (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        initial_capital DECIMAL(15, 2) DEFAULT 0.00,
        current_capital DECIMAL(15, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);
    
    console.log('✅ Таблица user_capital создана успешно');
    
    // Проверяем структуру таблицы
    const result = await postgresDatabase.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_capital'
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Структура таблицы user_capital:');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка создания таблицы user_capital:', error);
  } finally {
    process.exit(0);
  }
}

createUserCapitalTable();