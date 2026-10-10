import { BrokerAdapter } from './BrokerAdapter';
import { TinkoffAdapter } from './TinkoffAdapter';
import { SberAdapter } from './SberAdapter';
import { PaperAdapter } from './PaperAdapter';

export type BrokerCode = 'paper' | 'tinkoff' | 'sber';

export class BrokerRouter {
  private adapters: Record<BrokerCode, BrokerAdapter>;

  constructor() {
    this.adapters = {
      paper: new PaperAdapter(),
      tinkoff: new TinkoffAdapter(),
      sber: new SberAdapter()
    };
  }

  getAdapter(broker: BrokerCode): BrokerAdapter {
    return this.adapters[broker];
  }
}
