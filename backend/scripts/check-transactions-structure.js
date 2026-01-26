const { postgresDatabase } = require('./src/config/postgres');

async function checkTransactionsStructure() {
  try {
    console.log('🔍 Проверка структуры транзакций...');
    
    // Проверяем структуру таблицы transactions
    const result = await postgresDatabase.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position;
    `);
    
    console.log('Структура таблицы transactions:');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Проверяем конкретные транзакции
    const transactions = await postgresDatabase.query(
      'SELECT id, user_id, asset_symbol, transaction_type, quantity, price, commission FROM transactions WHERE user_id = $1',
      [2]
    );
    
    console.log('\n📊 Детали транзакций:');
    transactions.rows.forEach(row => {
      console.log(`ID: ${row.id}, Symbol: '${row.asset_symbol}', Type: ${row.transaction_type}, Quantity: ${row.quantity}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки структуры:', error);
  } finally {
    process.exit(0);
  }
}

checkTransactionsStructure();