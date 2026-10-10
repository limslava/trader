import { postgresDatabase } from '../../config/postgres';

export interface InstrumentInfo {
  exchange: string;
  symbol: string;
  lotSize: number;
  tickSize: number;
  currency: string;
  instrumentId?: string | null;
}

export class InstrumentService {
  async getInstrument(exchange: string, symbol: string): Promise<InstrumentInfo | null> {
    const result = await postgresDatabase.query(
      `SELECT exchange, symbol, lot_size, tick_size, currency, instrument_id
       FROM instruments
       WHERE exchange = $1 AND symbol = $2`,
      [exchange, symbol]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      exchange: row.exchange,
      symbol: row.symbol,
      lotSize: Number(row.lot_size),
      tickSize: Number(row.tick_size),
      currency: row.currency,
      instrumentId: row.instrument_id
    };
  }

  async getInstrumentId(exchange: string, symbol: string): Promise<string | null> {
    const instrument = await this.getInstrument(exchange, symbol);
    return instrument?.instrumentId || null;
  }
}
