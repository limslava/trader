import axios from 'axios';
import https from 'https';

const SANDBOX_BASE = process.env.TINKOFF_SANDBOX_API_URL || 'https://sandbox-invest-public-api.tbank.ru/rest/';

const toMoneyValue = (amount: number, currency: string) => {
  const units = Math.trunc(amount);
  const nano = Math.round((amount - units) * 1_000_000_000);
  return { units, nano, currency };
};

export class TinkoffSandboxService {
  private httpsAgent = process.env.TINKOFF_ALLOW_INSECURE === 'true'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

  async openAccount(token: string, name?: string): Promise<string> {
    const url = `${SANDBOX_BASE}tinkoff.public.invest.api.contract.v1.SandboxService/OpenSandboxAccount`;
    const response = await axios.post(url, { name: name ? [name] : [] }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      httpsAgent: this.httpsAgent
    });

    const accountId = response.data?.accountId || response.data?.account_id;
    if (!accountId) {
      throw new Error('Sandbox account id missing');
    }
    return accountId;
  }

  async payIn(token: string, accountId: string, amount: number, currency = 'RUB'): Promise<void> {
    const url = `${SANDBOX_BASE}tinkoff.public.invest.api.contract.v1.SandboxService/SandboxPayIn`;
    await axios.post(url, { accountId, amount: toMoneyValue(amount, currency) }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      httpsAgent: this.httpsAgent
    });
  }

  async getAccounts(token: string): Promise<any[]> {
    const url = `${SANDBOX_BASE}tinkoff.public.invest.api.contract.v1.SandboxService/GetSandboxAccounts`;
    const response = await axios.post(url, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      httpsAgent: this.httpsAgent
    });
    return response.data?.accounts || [];
  }
}
