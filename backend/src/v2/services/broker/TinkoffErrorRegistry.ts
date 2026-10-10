import { postgresDatabase } from '../../../config/postgres';
import fs from 'fs';

export class TinkoffErrorRegistry {
  async get(code?: string | null): Promise<string | null> {
    if (!code) return null;
    try {
      const result = await postgresDatabase.query(
        'SELECT message FROM tinkoff_error_map WHERE code = $1',
        [code]
      );
      return result.rows[0]?.message || null;
    } catch (error) {
      console.warn('[TinkoffErrorRegistry] DB unavailable', error);
      return null;
    }
  }

  async upsert(code: string, message: string): Promise<void> {
    await postgresDatabase.query(
      `INSERT INTO tinkoff_error_map (code, message, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (code)
       DO UPDATE SET message = EXCLUDED.message, updated_at = NOW()`,
      [code, message]
    );
  }

  async list(): Promise<Record<string, string>> {
    const result = await postgresDatabase.query('SELECT code, message FROM tinkoff_error_map');
    const map: Record<string, string> = {};
    for (const row of result.rows) {
      map[row.code] = row.message;
    }
    return map;
  }

  async seed(map: Record<string, string>): Promise<number> {
    const entries = Object.entries(map || {});
    if (entries.length === 0) return 0;
    for (const [code, message] of entries) {
      if (!code || !message) continue;
      await this.upsert(String(code), String(message));
    }
    return entries.length;
  }

  async seedFromFile(filePath: string): Promise<number> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Seed file not found: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid JSON in seed file: ${filePath}`);
    }
    return this.seed(parsed);
  }
}
