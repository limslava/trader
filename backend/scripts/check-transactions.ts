import { postgresDatabase } from './src/config/postgres';

async function checkTransactions() {
  try {
    const result = await postgresDatabase.query(
      "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 5"
    );
    console.log('Последние 5 транзакций:');
    result.rows.forEach((row: any, index: number) => {
      console.log(`${index + 1}. ID: ${row.id}, Symbol: ${row.asset_symbol}, Type: ${row.transaction_type}, Quantity: ${row.quantity}, Price: ${row.price}, Total: ${row.total_amount}, Date: ${row.timestamp}`);
    });
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

checkTransactions();