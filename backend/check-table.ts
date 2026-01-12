import { postgresDatabase } from './src/config/postgres';

async function checkTable() {
  try {
    const result = await postgresDatabase.query('SELECT * FROM transactions LIMIT 1');
    console.log('Структура таблицы transactions:');
    result.fields.forEach((field: any) => {
      console.log(`  ${field.name}: ${field.dataTypeID}`);
    });
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    // Connection will be managed by the pool
  }
}

checkTable();