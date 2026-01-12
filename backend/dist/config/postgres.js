"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postgresDatabase = exports.PostgresDatabase = void 0;
const pg_1 = require("pg");
class PostgresDatabase {
    constructor() {
        this.isConnected = false;
        this.pool = new pg_1.Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5433'),
            database: process.env.POSTGRES_DB || 'russian-trader',
            user: process.env.POSTGRES_USER || 'trader',
            password: process.env.POSTGRES_PASSWORD || 'trader123',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        this.pool.on('error', (err) => {
            console.error('❌ Ошибка подключения к PostgreSQL:', err);
            this.isConnected = false;
        });
    }
    async connect() {
        try {
            const client = await this.pool.connect();
            console.log('✅ PostgreSQL подключена успешно');
            await this.checkTables();
            client.release();
            this.isConnected = true;
        }
        catch (error) {
            console.error('❌ Ошибка подключения к PostgreSQL:', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.pool.end();
            console.log('📊 PostgreSQL отключена');
            this.isConnected = false;
        }
        catch (error) {
            console.error('❌ Ошибка отключения от PostgreSQL:', error);
            throw error;
        }
    }
    getConnectionStatus() {
        return this.isConnected;
    }
    getPool() {
        return this.pool;
    }
    async checkTables() {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
            if (!result.rows[0].exists) {
                console.log('⚠️ Таблицы не найдены. Запустите docker-compose для инициализации базы данных.');
            }
            else {
                console.log('📊 Таблицы PostgreSQL готовы к работе');
            }
            client.release();
        }
        catch (error) {
            console.error('❌ Ошибка проверки таблиц:', error);
        }
    }
    async query(text, params) {
        try {
            const result = await this.pool.query(text, params);
            return result;
        }
        catch (error) {
            console.error('❌ Ошибка выполнения запроса:', error);
            throw error;
        }
    }
}
exports.PostgresDatabase = PostgresDatabase;
exports.postgresDatabase = new PostgresDatabase();
exports.default = exports.postgresDatabase;
//# sourceMappingURL=postgres.js.map