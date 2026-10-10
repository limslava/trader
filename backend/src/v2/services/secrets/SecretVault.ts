export interface SecretVault {
  put(secret: string): Promise<string>;
  get(ref: string): Promise<string | null>;
}

export class InMemorySecretVault implements SecretVault {
  private store = new Map<string, string>();

  async put(secret: string): Promise<string> {
    const ref = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.store.set(ref, secret);
    return ref;
  }

  async get(ref: string): Promise<string | null> {
    return this.store.get(ref) || null;
  }
}
