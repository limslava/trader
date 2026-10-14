export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Minimal in-process TTL cache; enough for a single-instance personal app.
 * Concurrent misses share one in-flight load (no stampede), and a failed load is remembered briefly
 * so an upstream outage does not turn into a retry storm.
 */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  private failures = new Map<string, { error: unknown; expires: number }>();
  private inflight = new Map<string, Promise<T>>();

  constructor(
    private ttlMs: number,
    private failureTtlMs = 15_000,
  ) {}

  clear(): void {
    this.store.clear();
    this.failures.clear();
  }

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expires > now) return hit.value;
    const failed = this.failures.get(key);
    if (failed && failed.expires > now) throw failed.error;
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const p = load()
      .then((value) => {
        this.store.set(key, { value, expires: Date.now() + this.ttlMs });
        this.failures.delete(key);
        this.evict();
        return value;
      })
      .catch((error: unknown) => {
        this.failures.set(key, { error, expires: Date.now() + this.failureTtlMs });
        throw error;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private evict() {
    if (this.store.size <= 500) return;
    const now = Date.now();
    for (const [k, v] of this.store) if (v.expires <= now) this.store.delete(k);
  }
}

/** Serializes async work per key; `tryLock` refuses instead of queueing (for expensive, non-idempotent jobs). */
export class KeyedLock {
  private chains = new Map<string, Promise<unknown>>();
  private held = new Set<string>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    this.chains.set(key, next);
    try {
      return await next;
    } finally {
      if (this.chains.get(key) === next) this.chains.delete(key);
    }
  }

  isHeld(key: string): boolean {
    return this.held.has(key);
  }

  async tryRun<T>(key: string, fn: () => Promise<T>, busyError: () => Error): Promise<T> {
    if (this.held.has(key)) throw busyError();
    this.held.add(key);
    try {
      return await fn();
    } finally {
      this.held.delete(key);
    }
  }
}

/** Sliding-window counter, e.g. "no more than N paid AI calls per minute". */
export class RateLimiter {
  private stamps: number[] = [];

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  take(): boolean {
    const now = Date.now();
    this.stamps = this.stamps.filter((t) => t > now - this.windowMs);
    if (this.stamps.length >= this.max) return false;
    this.stamps.push(now);
    return true;
  }
}

/** Today's date in Moscow (MOEX/T-Invest calendars are in MSK; the server may run in UTC). */
export function todayMsk(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}
