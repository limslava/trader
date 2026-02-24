const { postgresDatabase } = require('./src/config/postgres');

async function checkCurrentPortfolio() {
  try {
    console.log('🔍 Проверка текущего портфеля...');
    
    // Проверяем позиции в портфеле
    const portfolioResult = await postgresDatabase.query(
      'SELECT symbol, quantity, average_price, current_price, total_value, profit_loss FROM portfolio WHERE user_id = $1', 
      [2]
    );
    
    console.log('📊 Позиции в портфеле:');
    portfolioResult.rows.forEach(row => {
      console.log(`${row.symbol}: ${row.quantity} акций по средней цене ${row.average_price} ₽, текущая цена: ${row.current_price} ₽, PnL: ${row.profit_loss} ₽`);
    });
    
    // Проверяем транзакции
    const transactionsResult = await postgresDatabase.query(
      'SELECT asset_symbol as symbol, transaction_type, quantity, price, commission FROM transactions WHERE user_id = $1 ORDER BY timestamp',
      [2]
    );
    
    console.log('\n📊 Все транзакции:');
    transactionsResult.rows.forEach(row => {
      console.log(`${row.transaction_type} ${row.quantity} ${row.symbol} по ${row.price} ₽, комиссия: ${row.commission} ₽`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки портфеля:', error);
  } finally {
    process.exit(0);
  }
}

checkCurrentPortfolio();