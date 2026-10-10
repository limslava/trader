import { CryptoErrorRegistry } from './CryptoErrorRegistry';

export interface OkxError {
  code?: string;
  message: string;
  details?: string;
}

export class OkxErrorParser {
  private registry = new CryptoErrorRegistry();

  async parse(error: any): Promise<OkxError> {
    if (error?.response?.data) {
      const data = error.response.data;
      const code = data?.code?.toString();
      return {
        code,
        message: (await this.registry.get('okx', code)) || data?.msg || data?.message || 'OKX API error',
        details: JSON.stringify(data)
      };
    }

    return { message: error?.message || 'OKX API error' };
  }
}
