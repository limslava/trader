const { postgresDatabase } = require('./src/config/postgres');

async function debugNumericOverflow() {
  try {
    console.log('🔍 Диагностика numeric field overflow...');
    
    const testValues = {
      userId: 2,
      symbol: 'TEST',
      assetType: 'STOCK',
      quantity: 10,
      price: 250,
      totalAmount: 2500,
      fee: 2.5,
      profitLoss: 0,
      profitLossPercent: 0
    };
    
    console.log('Тестовые значения:');
    console.log('quantity:', testValues.quantity, 'type:', typeof testValues.quantity);
    console.log('price:', testValues.price, 'type:', typeof testValues.price);
    console.log('totalAmount:', testValues.totalAmount, 'type:', typeof testValues.totalAmount);
    console.log('fee:', testValues.fee, 'type:', typeof testValues.fee);
    console.log('profitLoss:', testValues.profitLoss, 'type:', typeof testValues.profitLoss);
    console.log('profitLossPercent:', testValues.profitLossPercent, 'type:', typeof testValues.profitLossPercent);
    
    // Проверим, какие значения вызывают ошибку
    console.log('\n🔍 Проверка вставки в portfolio...');
    try {
      await postgresDatabase.query(`
        INSERT INTO portfolio
        (user_id, symbol, asset_type, quantity, average_price, current_price,
         total_value, profit_loss, profit_loss_percent, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        testValues.userId, testValues.symbol, testValues.assetType,
        testValues.quantity, testValues.price, testValues.price,
        testValues.totalAmount, testValues.profitLoss, testValues.profitLossPercent
      ]);
      console.log('✅ Вставка в portfolio успешна');
    } catch (error) {
      console.log('❌ Ошибка вставки в portfolio:', error.message);
    }
    
    // Очистим тестовые данные
    await postgresDatabase.query('DELETE FROM portfolio WHERE symbol = $1', [testValues.symbol]);
    
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
  } finally {
    process.exit(0);
  }
}

debugNumericOverflow();