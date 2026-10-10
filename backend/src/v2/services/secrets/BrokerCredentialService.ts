import { SecretRegistry } from './SecretRegistry';
import { secretStore } from './SecretStore';

export class BrokerCredentialService {
  private registry = new SecretRegistry();

  async getCredential(tenantId: string, brokerAccountId: string): Promise<string | null> {
    const ref = await this.registry.getRef(tenantId, brokerAccountId);
    if (ref) {
      const secret = await secretStore.get(ref);
      if (secret) return secret;
    }

    return null;
  }
}
