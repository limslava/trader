import fs from 'fs';
import path from 'path';
import { postgresDatabase } from '../../../config/postgres';

const defaultPath = path.resolve(process.cwd(), 'backend/config/crypto-error-map.json');

export class CryptoErrorRegistry {
  private filePath: string;
  private cache: Record<string, Record<string, string>> = {};
  private useDb: boolean;

  constructor(filePath = defaultPath) {
    this.filePath = filePath;
    this.useDb = process.env.CRYPTO_ERROR_MAP_DB !== 'false';
    if (!this.useDb) {
      this.loadFile();
    }
  }

  private loadFile() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.cache = JSON.parse(raw);
      } catch (_error) {
        this.cache = {};
      }
    }
  }

  private async loadDb(exchange: string): Promise<Record<string, string>> {
    try {
      const result = await postgresDatabase.query(
        'SELECT code, message FROM crypto_error_map WHERE exchange = $1',
        [exchange]
      );
      const map: Record<string, string> = {};
      for (const row of result.rows) {
        map[row.code] = row.message;
      }
      return map;
    } catch (error) {
      console.warn('[CryptoErrorRegistry] DB unavailable, fallback to file', error);
      if (!Object.keys(this.cache).length) {
        this.loadFile();
      }
      return this.cache?.[exchange] || {};
    }
  }

  async get(exchange: string, code?: string | null): Promise<string | null> {
    if (!code) return null;
    if (this.useDb) {
      const map = await this.loadDb(exchange);
      return map[code] || null;
    }
    return this.cache?.[exchange]?.[code] || null;
  }

  async upsert(exchange: string, code: string, message: string) {
    if (this.useDb) {
      await postgresDatabase.query(
        `INSERT INTO crypto_error_map (exchange, code, message, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (exchange, code)
         DO UPDATE SET message = EXCLUDED.message, updated_at = NOW()`,
        [exchange, code, message]
      );
      return;
    }

    if (!this.cache[exchange]) this.cache[exchange] = {};
    this.cache[exchange][code] = message;
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2));
  }

  async list(exchange: string): Promise<Record<string, string>> {
    if (this.useDb) {
      return this.loadDb(exchange);
    }
    return this.cache?.[exchange] || {};
  }
}
