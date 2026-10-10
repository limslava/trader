export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Minimal in-process TTL cache; enough for a single-instance personal app. */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expires: number }>();

  constructor(private ttlMs: number) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await load();
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    if (this.store.size > 500) {
      for (const [k, v] of this.store) if (v.expires <= Date.now()) this.store.delete(k);
    }
    return value;
  }
}
