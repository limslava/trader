import axios from 'axios';
import { SecretVault } from './SecretVault';
import { VaultHealth } from './VaultHealth';
import { VaultRetry } from './VaultRetry';

interface VaultConfig {
  addr: string;
  token: string;
  mount: string;
}

export class VaultSecretVault implements SecretVault {
  private config: VaultConfig;
  private health = new VaultHealth();
  private retry = new VaultRetry();

  constructor(config: VaultConfig) {
    this.config = config;
  }

  async put(secret: string): Promise<string> {
    return this.retry.withRetry(async () => {
      const ok = await this.health.check(this.config.addr);
      if (!ok) {
        throw new Error('Vault unavailable');
      }
      const path = `secrets/${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = `${this.config.addr}/v1/${this.config.mount}/data/${path}`;
      await axios.post(
        url,
        { data: { value: secret } },
        {
          headers: {
            'X-Vault-Token': this.config.token
          },
          timeout: 8000
        }
      );
      return `vault:${this.config.mount}:${path}`;
    });
  }

  async get(ref: string): Promise<string | null> {
    return this.retry.withRetry(async () => {
      const ok = await this.health.check(this.config.addr);
      if (!ok) {
        throw new Error('Vault unavailable');
      }
      const parts = ref.split(':');
      if (parts.length < 3 || parts[0] !== 'vault') return null;
      const mount = parts[1];
      const path = parts.slice(2).join(':');
      const url = `${this.config.addr}/v1/${mount}/data/${path}`;
      const response = await axios.get(url, {
        headers: { 'X-Vault-Token': this.config.token },
        timeout: 8000
      });
      return response.data?.data?.data?.value || null;
    });
  }
}
