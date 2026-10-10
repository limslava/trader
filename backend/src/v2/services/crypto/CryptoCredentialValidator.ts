export class CryptoCredentialValidator {
  validate(exchange: string, credential: string): { ok: boolean; message?: string } {
    const parts = credential.split(':');

    if (exchange === 'bybit') {
      if (parts.length !== 2) return { ok: false, message: 'Bybit credential must be apiKey:apiSecret' };
      return { ok: true };
    }

    if (exchange === 'okx' || exchange === 'kucoin') {
      if (parts.length !== 3) return { ok: false, message: 'Credential must be apiKey:apiSecret:passphrase' };
      return { ok: true };
    }

    return { ok: false, message: 'Unsupported exchange' };
  }
}
