const { postgresDatabase } = require('./src/config/postgres.ts');

async function checkCashBalance() {
  try {
    console.log('💰 Проверка расчета денежных средств...');
    
    const userId = 2;
    
    // Проверяем все транзакции пользователя
    const transactionsResult = await postgresDatabase.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY timestamp', 
      [userId]
    );
    
    console.log('📊 Все транзакции пользователя:');
    let totalCashFlow = 0;
    let startBalance = 100000;
    
    transactionsResult.rows.forEach(row => {
      let cashFlow = 0;
      if (row.transaction_type === 'buy') {
        cashFlow = -(row.quantity * row.price + row.commission);
      } else if (row.transaction_type === 'sell') {
        cashFlow = row.quantity * row.price - row.commission;
      }
      
      totalCashFlow += cashFlow;
      
      console.log(`${row.transaction_type} ${row.quantity} ${row.symbol} по ${row.price} ₽, комиссия: ${row.commission} ₽ => Денежный поток: ${cashFlow.toFixed(2)} ₽`);
    });
    
    const calculatedBalance = startBalance + totalCashFlow;
    
    console.log('\n💰 Расчет денежных средств:');
    console.log(`Стартовый баланс: ${startBalance.toFixed(2)} ₽`);
    console.log(`Общий денежный поток: ${totalCashFlow.toFixed(2)} ₽`);
    console.log(`Рассчитанный баланс: ${calculatedBalance.toFixed(2)} ₽`);
    
    // Проверяем через метод сервиса
    const { PostgresPortfolioService } = require('./src/services/PostgresPortfolioService');
    const portfolioService = new PostgresPortfolioService();
    const serviceBalance = await portfolioService.calculateCashBalance(userId.toString());
    
    console.log(`Баланс через сервис: ${serviceBalance.toFixed(2)} ₽`);
    
    // Проверяем через API
    console.log('\n🔍 Проверка через API...');
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:3001/api/portfolio', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiMjcyMDIzM0BnbWFpbC5jb20iLCJ1c2VybmFtZSI6InRlc3RfdXNlciIsImlhdCI6MTczMDc0MjU5OSwiZXhwIjoxNzMwODI4OTk5fQ.9vJQJ8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q'
      }
    });
    
    if (response.ok) {
      const portfolio = await response.json();
      console.log(`Баланс через API: ${portfolio.data.cashBalance.toFixed(2)} ₽`);
    } else {
      console.log('❌ Ошибка при запросе к API');
    }
    
  } catch (error) {
    console.error('❌ Ошибка проверки денежных средств:', error);
  } finally {
    process.exit(0);
  }
}

checkCashBalance();