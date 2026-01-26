const { postgresDatabase } = require('./src/config/postgres');

async function checkPortfolioData() {
  try {
    console.log('📊 Проверка данных портфеля...');
    
    // Проверяем позиции в портфеле
    const portfolioResult = await postgresDatabase.query(
      'SELECT * FROM portfolio WHERE user_id = $1', 
      [2]
    );
    
    console.log('Позиции в портфеле:');
    portfolioResult.rows.forEach(row => {
      console.log(`${row.symbol}: ${row.quantity} акций по средней цене ${row.average_price}, текущая цена: ${row.current_price}`);
    });
    
    // Проверяем транзакции
    const transactionsResult = await postgresDatabase.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 10', 
      [2]
    );
    
    console.log('\nПоследние транзакции:');
    transactionsResult.rows.forEach(row => {
      console.log(`${row.transaction_type} ${row.quantity} ${row.symbol} по цене ${row.price}, комиссия: ${row.commission}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки данных:', error);
  } finally {
    process.exit(0);
  }
}

checkPortfolioData();