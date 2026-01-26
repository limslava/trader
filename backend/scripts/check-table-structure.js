const { postgresDatabase } = require('./src/config/postgres');

async function checkTableStructure() {
  try {
    console.log('📊 Проверка структуры таблицы portfolio...');
    
    const result = await postgresDatabase.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale 
      FROM information_schema.columns 
      WHERE table_name = 'portfolio'
      ORDER BY ordinal_position;
    `);
    
    console.log('Структура таблицы portfolio:');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (${row.numeric_precision},${row.numeric_scale})`);
    });
    
    console.log('\n📊 Проверка структуры таблицы transactions...');
    
    const result2 = await postgresDatabase.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position;
    `);
    
    console.log('Структура таблицы transactions:');
    result2.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (${row.numeric_precision},${row.numeric_scale})`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки структуры таблиц:', error);
  } finally {
    process.exit(0);
  }
}

checkTableStructure();