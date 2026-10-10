import axios from 'axios';
import https from 'https';
import { postgresDatabase } from '../../../config/postgres';
import { BrokerCredentialService } from '../secrets/BrokerCredentialService';

const PROD_BASE = process.env.TINKOFF_API_URL || 'https://invest-public-api.tbank.ru/rest/';
const SANDBOX_BASE = process.env.TINKOFF_SANDBOX_API_URL || 'https://sandbox-invest-public-api.tbank.ru/rest/';
const MOEX_BASE = process.env.MOEX_API_BASE_URL || 'https://iss.moex.com/iss';

export class TinkoffInstrumentsService {
  private credentials = new BrokerCredentialService();
  private httpsAgent = process.env.TINKOFF_ALLOW_INSECURE === 'true'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const code = error?.code;
        if (i < attempts - 1 && (code === 'ECONNRESET' || code === 'ERR_BAD_RESPONSE')) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async syncStocks(tenantId: string, brokerAccountId: string): Promise<number> {
    return this.syncByEndpoint(tenantId, brokerAccountId, 'Shares', {
      instrumentStatus: 'INSTRUMENT_STATUS_BASE',
      allowFallback: true,
      forceTinkoff: false
    });
  }

  async syncStocksFull(tenantId: string, brokerAccountId: string): Promise<number> {
    return this.syncByEndpoint(tenantId, brokerAccountId, 'Shares', {
      instrumentStatus: 'INSTRUMENT_STATUS_ALL',
      allowFallback: false,
      forceTinkoff: true,
      clearExisting: true
    });
  }

  async syncFutures(tenantId: string, brokerAccountId: string): Promise<number> {
    return this.syncByEndpoint(tenantId, brokerAccountId, 'Futures', {
      instrumentStatus: 'INSTRUMENT_STATUS_BASE',
      allowFallback: true,
      forceTinkoff: false
    });
  }

  async syncOptions(tenantId: string, brokerAccountId: string): Promise<number> {
    return this.syncByEndpoint(tenantId, brokerAccountId, 'Options', {
      instrumentStatus: 'INSTRUMENT_STATUS_BASE',
      allowFallback: true,
      forceTinkoff: false
    });
  }

  private async syncByEndpoint(
    tenantId: string,
    brokerAccountId: string,
    endpoint: 'Shares' | 'Futures' | 'Options',
    options: { instrumentStatus: string; allowFallback: boolean; forceTinkoff: boolean; clearExisting?: boolean }
  ): Promise<number> {
    const token = await this.credentials.getCredential(tenantId, brokerAccountId);
    if (!token) {
      throw new Error('Missing broker credential');
    }

    const baseUrl = options.forceTinkoff
      ? (process.env.TINKOFF_API_URL || PROD_BASE)
      : (process.env.TINKOFF_INSTRUMENTS_API_URL || PROD_BASE);
    const url = `${baseUrl}tinkoff.public.invest.api.contract.v1.InstrumentsService/${endpoint}`;

    let items: any[] = [];
    if (options.clearExisting) {
      await postgresDatabase.query(`DELETE FROM instruments WHERE exchange = 'MOEX'`);
    }
    try {
      const response = await this.withRetry(async () => {
        return axios.post(url, { instrumentStatus: options.instrumentStatus }, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'identity'
          },
          timeout: 60000,
          responseType: 'stream',
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          httpsAgent: this.httpsAgent
        });
      });

      const data = await new Promise<string>((resolve, reject) => {
        let raw = '';
        response.data.on('data', (chunk: Buffer) => {
          raw += chunk.toString('utf-8');
        });
        response.data.on('end', () => resolve(raw));
        response.data.on('error', reject);
      });

      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch (error) {
        throw new Error('Failed to parse instruments response');
      }
      items = parsed?.instruments || [];
    } catch (error: any) {
      const code = error?.code;
      if (options.allowFallback && (code === 'ECONNRESET' || code === 'ERR_BAD_RESPONSE')) {
        console.warn('Tinkoff instruments API unstable, falling back to MOEX ISS');
        items = await this.fetchMoexShares();
      } else {
        throw error;
      }
    }
    let upserted = 0;

    for (const item of items) {
      const symbol = item.ticker;
      if (!symbol && item.SECID) {
        item.ticker = item.SECID;
      }
      if (!symbol) continue;

      const classCode = item.classCode || item.class_code || null;
      const exchange = item.exchange || item.exchange_code || null;
      const isMoex = (classCode && String(classCode).startsWith('TQ')) || exchange === 'MOEX';
      if (!isMoex) {
        continue;
      }

      const instrumentId = item.uid || item.figi || item.instrumentId || null;
      if (!instrumentId) {
        continue;
      }
      const lotSize = item.lot || item.LOTSIZE || 1;
      const tickSize = 0.01;
      const currency = item.currency || item.CURRENCYID || 'RUB';
      const name = item.name || item.NAME || item.SHORTNAME || null;

      await postgresDatabase.query(
        `INSERT INTO instruments (exchange, symbol, name, lot_size, tick_size, currency, instrument_id, created_at, updated_at)
         VALUES ('MOEX', $1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (exchange, symbol)
         DO UPDATE SET name = EXCLUDED.name,
                       lot_size = EXCLUDED.lot_size,
                       tick_size = EXCLUDED.tick_size,
                       currency = EXCLUDED.currency,
                       instrument_id = EXCLUDED.instrument_id,
                       updated_at = NOW()`,
        [symbol, name, lotSize, tickSize, currency, instrumentId]
      );
      upserted += 1;
    }

    return upserted;
  }

  private async fetchMoexShares(): Promise<any[]> {
    const url = `${MOEX_BASE}/securities.json`;
    const response = await axios.get(url, {
      params: {
        'iss.meta': 'off',
        'iss.only': 'securities',
        'securities.columns': 'SECID,SHORTNAME,NAME,CURRENCYID,LOTSIZE,TYPE,MARKET',
        engine: 'stock',
        market: 'shares'
      },
      timeout: 20000
    });

    const columns: string[] = response.data?.securities?.columns || [];
    const data: any[] = response.data?.securities?.data || [];
    const idx = (name: string) => columns.indexOf(name);
    const mapped = data.map((row) => ({
      SECID: row[idx('SECID')],
      SHORTNAME: row[idx('SHORTNAME')],
      NAME: row[idx('NAME')],
      CURRENCYID: row[idx('CURRENCYID')],
      LOTSIZE: row[idx('LOTSIZE')]
    }));
    return mapped.filter((row) => row.SECID);
  }
}
