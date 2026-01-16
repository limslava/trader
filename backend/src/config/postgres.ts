import { Pool } from 'pg';

export class PostgresDatabase {
  private pool: Pool;
  private isConnected = false;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    let poolConfig: any;

    if (databaseUrl) {
      // Парсим DATABASE_URL
      const url = new URL(databaseUrl);
      poolConfig = {
        host: url.hostname,
        port: parseInt(url.port || '5432'),
        database: url.pathname.slice(1), // Убираем ведущий слэш
        user: url.username,
        password: url.password,
        ssl: url.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };
    } else {
      // Используем отдельные переменные
      poolConfig = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'russian-trader',
        user: process.env.POSTGRES_USER || 'trader',
        password: process.env.POSTGRES_PASSWORD || 'trader123',
        ssl: false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };
    }

    this.pool = new Pool(poolConfig);

    // Обработка ошибок подключения
    this.pool.on('error', (err) => {
      console.error('❌ Ошибка подключения к PostgreSQL:', err);
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      console.log('✅ PostgreSQL подключена успешно');
      
      // Проверяем существование таблиц
      await this.checkTables();
      
      client.release();
      this.isConnected = true;
    } catch (error) {
      console.error('❌ Ошибка подключения к PostgreSQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      console.log('📊 PostgreSQL отключена');
      this.isConnected = false;
    } catch (error) {
      console.error('❌ Ошибка отключения от PostgreSQL:', error);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getPool(): Pool {
    return this.pool;
  }

  // Проверка существования таблиц
  private async checkTables(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      // Проверяем существование таблицы users
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      if (!result.rows[0].exists) {
        console.log('⚠️ Таблицы не найдены. Запустите docker-compose для инициализации базы данных.');
      } else {
        console.log('📊 Таблицы PostgreSQL готовы к работе');
      }
      
      client.release();
    } catch (error) {
      console.error('❌ Ошибка проверки таблиц:', error);
    }
  }

  // Метод для выполнения запросов
  async query(text: string, params?: any[]): Promise<any> {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('❌ Ошибка выполнения запроса:', error);
      throw error;
    }
  }
}

// Экспортируем синглтон экземпляр
export const postgresDatabase = new PostgresDatabase();
export default postgresDatabase;