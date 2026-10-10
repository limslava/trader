export interface TinkoffError {
  code?: string;
  message: string;
  details?: string;
}

import { TinkoffErrorRegistry } from './TinkoffErrorRegistry';

export class TinkoffErrorParser {
  private registry = new TinkoffErrorRegistry();

  async parse(error: any): Promise<TinkoffError> {
    if (error?.response?.data) {
      const data = error.response.data;
      const code = String(data?.code || data?.errorCode || 'UNKNOWN');
      const mapped = await this.registry.get(code);
      return {
        code,
        message: mapped || data?.message || data?.error || 'Tinkoff API error',
        details: JSON.stringify(data)
      };
    }

    const fallbackCode = String(error?.code || 'UNKNOWN');
    const mapped = await this.registry.get(fallbackCode);
    return {
      code: fallbackCode,
      message: mapped || error?.message || 'Tinkoff API error'
    };
  }
}
