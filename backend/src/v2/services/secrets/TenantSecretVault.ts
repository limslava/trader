import { InMemorySecretVault } from './SecretVault';

export class TenantSecretVault {
  private vault = new InMemorySecretVault();

  async put(tenantId: string, secret: string): Promise<string> {
    const ref = await this.vault.put(secret);
    return `tenant:${tenantId}:${ref}`;
  }

  async get(refOrTenantId: string, maybeRef?: string): Promise<string | null> {
    const ref = maybeRef ?? refOrTenantId;
    const parts = ref.split(':');
    const underlying = parts.slice(2).join(':');
    return this.vault.get(underlying);
  }
}
