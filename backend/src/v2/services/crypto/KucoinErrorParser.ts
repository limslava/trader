import { CryptoErrorRegistry } from './CryptoErrorRegistry';

export interface KucoinError {
  code?: string;
  message: string;
  details?: string;
}

export class KucoinErrorParser {
  private registry = new CryptoErrorRegistry();

  async parse(error: any): Promise<KucoinError> {
    if (error?.response?.data) {
      const data = error.response.data;
      const code = data?.code?.toString();
      return {
        code,
        message: (await this.registry.get('kucoin', code)) || data?.msg || data?.message || 'KuCoin API error',
        details: JSON.stringify(data)
      };
    }

    return { message: error?.message || 'KuCoin API error' };
  }
}
