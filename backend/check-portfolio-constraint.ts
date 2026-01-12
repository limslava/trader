import { postgresDatabase } from './src/config/postgres';

async function checkConstraint() {
  try {
    const result = await postgresDatabase.query(
      "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'portfolio_asset_type_check'"
    );
    console.log('CHECK constraint для portfolio:', result.rows[0]);
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

checkConstraint();