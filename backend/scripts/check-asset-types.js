const { postgresDatabase } = require('./src/config/postgres');

async function checkTransactionsAssetType() {
  try {
    console.log('🔍 Проверка типа активов в транзакциях...');
    
    // Проверяем транзакции
    const transactionsResult = await postgresDatabase.query(
      'SELECT id, asset_symbol, asset_type FROM transactions WHERE user_id = $1', 
      [2]
    );
    
    console.log('📊 Типы активов в транзакциях:');
    transactionsResult.rows.forEach(row => {
      console.log(`ID: ${row.id}, Symbol: '${row.asset_symbol}', Asset Type: '${row.asset_type}'`);
    });
    
    // Проверяем портфель
    const portfolioResult = await postgresDatabase.query(
      'SELECT id, symbol, asset_type FROM portfolio WHERE user_id = $1', 
      [2]
    );
    
    console.log('\n📊 Типы активов в портфеле:');
    portfolioResult.rows.forEach(row => {
      console.log(`ID: ${row.id}, Symbol: '${row.symbol}', Asset Type: '${row.asset_type}'`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки типов активов:', error);
  } finally {
    process.exit(0);
  }
}

checkTransactionsAssetType();