import axios from 'axios';

export class VaultHealth {
  private lastCheckedAt = 0;
  private lastResult = false;

  async check(addr: string, ttlMs = 5000): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastCheckedAt < ttlMs) {
      return this.lastResult;
    }

    try {
      const res = await axios.get(`${addr}/v1/sys/health`, { timeout: 4000 });
      this.lastResult = res.status >= 200 && res.status < 500;
    } catch (_error) {
      this.lastResult = false;
    }

    this.lastCheckedAt = now;
    return this.lastResult;
  }
}
