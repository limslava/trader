const { postgresDatabase } = require('./src/config/postgres');

async function checkPortfolioValues() {
  try {
    console.log('🔍 Проверка значений портфеля...');
    
    // Проверяем позиции в портфеле
    const portfolioResult = await postgresDatabase.query(
      'SELECT symbol, quantity, average_price, current_price, total_value FROM portfolio WHERE user_id = $1', 
      [2]
    );
    
    console.log('📊 Значения портфеля:');
    portfolioResult.rows.forEach(row => {
      console.log(`${row.symbol}:`);
      console.log(`  Количество: ${row.quantity} (тип: ${typeof row.quantity})`);
      console.log(`  Средняя цена: ${row.average_price} (тип: ${typeof row.average_price})`);
      console.log(`  Текущая цена: ${row.current_price} (тип: ${typeof row.current_price})`);
      console.log(`  Общая стоимость: ${row.total_value} (тип: ${typeof row.total_value})`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки значений:', error);
  } finally {
    process.exit(0);
  }
}

checkPortfolioValues();