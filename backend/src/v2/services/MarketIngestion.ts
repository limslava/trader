import { MarketNormalizer } from './MarketNormalizer';
import { MarketTick, NormalizedTick } from '../types/market';
import { postgresDatabase } from '../../config/postgres';

export class MarketIngestionService {
  private normalizer = new MarketNormalizer();

  async ingest(tick: MarketTick): Promise<NormalizedTick> {
    const normalized = await this.normalizer.normalize(tick);
    await postgresDatabase.query(
      `INSERT INTO market_ticks (exchange, symbol, price, ts, source, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        normalized.exchange,
        normalized.normalizedSymbol,
        normalized.price,
        normalized.ts,
        normalized.source
      ]
    );
    return normalized;
  }
}
