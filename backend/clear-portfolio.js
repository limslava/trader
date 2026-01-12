const { postgresDatabase } = require('./src/config/postgres');

async function clearPortfolio() {
  try {
    console.log('🧹 Очистка портфеля...');
    
    // Удаляем все транзакции и позиции пользователя
    await postgresDatabase.query('DELETE FROM transactions WHERE user_id = $1', [2]);
    await postgresDatabase.query('DELETE FROM portfolio WHERE user_id = $1', [2]);
    
    console.log('✅ Портфель очищен');
  } catch (error) {
    console.error('❌ Ошибка очистки портфеля:', error);
  } finally {
    process.exit(0);
  }
}

clearPortfolio();