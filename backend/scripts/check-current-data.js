const { postgresDatabase } = require('./src/config/postgres');

async function checkCurrentData() {
  try {
    console.log('🔍 Проверка текущих данных в базе...');
    
    // Проверяем транзакции
    const transactionsResult = await postgresDatabase.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC', 
      [2]
    );
    
    console.log('📊 Транзакции пользователя:');
    if (transactionsResult.rows.length === 0) {
      console.log('❌ Нет транзакций');
    } else {
      transactionsResult.rows.forEach(row => {
        console.log(`${row.transaction_type} ${row.quantity} ${row.symbol} по ${row.price} ₽, комиссия: ${row.commission} ₽`);
      });
    }
    
    // Проверяем портфель
    const portfolioResult = await postgresDatabase.query(
      'SELECT * FROM portfolio WHERE user_id = $1', 
      [2]
    );
    
    console.log('\n📊 Позиции в портфеле:');
    if (portfolioResult.rows.length === 0) {
      console.log('❌ Нет позиций в портфеле');
    } else {
      portfolioResult.rows.forEach(row => {
        console.log(`${row.symbol}: ${row.quantity} акций по средней цене ${row.average_price} ₽, текущая цена: ${row.current_price} ₽`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка проверки данных:', error);
  } finally {
    process.exit(0);
  }
}

checkCurrentData();