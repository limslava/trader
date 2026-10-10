import { CryptoCircuitBreaker } from './CryptoCircuitBreaker';

export interface CryptoRetryPolicy {
  attempts: number;
  baseDelayMs: number;
  breakerThreshold: number;
  breakerOpenMs: number;
}

export class CryptoRetry {
  private breaker: CryptoCircuitBreaker;
  private policy: CryptoRetryPolicy;

  constructor(policy?: Partial<CryptoRetryPolicy>) {
    this.policy = {
      attempts: policy?.attempts ?? 3,
      baseDelayMs: policy?.baseDelayMs ?? 200,
      breakerThreshold: policy?.breakerThreshold ?? 5,
      breakerOpenMs: policy?.breakerOpenMs ?? 10_000
    };
    this.breaker = new CryptoCircuitBreaker(this.policy.breakerThreshold, this.policy.breakerOpenMs);
  }

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    if (this.breaker.isOpen()) {
      throw new Error('Circuit breaker open');
    }

    let lastError: any;
    for (let i = 0; i < this.policy.attempts; i += 1) {
      try {
        const result = await fn();
        this.breaker.onSuccess();
        return result;
      } catch (error) {
        lastError = error;
        this.breaker.onFailure();
        if (i < this.policy.attempts - 1) {
          const jitter = Math.floor(Math.random() * 100);
          await new Promise((resolve) => setTimeout(resolve, this.policy.baseDelayMs * Math.pow(2, i) + jitter));
        }
      }
    }
    throw lastError;
  }
}
