import { MarketTick, NormalizedTick } from '../types/market';
import { InstrumentService } from './InstrumentService';

export class MarketNormalizer {
  private instrumentService = new InstrumentService();

  async normalize(tick: MarketTick): Promise<NormalizedTick> {
    const normalizedSymbol = tick.symbol.trim().toUpperCase();
    const exchange = tick.source === 'moex' ? 'MOEX' : 'CRYPTO';

    let price = tick.price;
    const instrument = await this.instrumentService.getInstrument(exchange, normalizedSymbol);

    if (instrument && instrument.tickSize > 0) {
      price = Math.round(price / instrument.tickSize) * instrument.tickSize;
    }

    return {
      ...tick,
      price,
      normalizedSymbol,
      exchange
    };
  }
}
