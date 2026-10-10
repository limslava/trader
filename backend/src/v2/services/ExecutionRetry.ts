export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
}

export class ExecutionRetry {
  shouldRetry(attempt: number, policy: RetryPolicy): boolean {
    return attempt < policy.maxAttempts;
  }

  nextDelay(attempt: number, policy: RetryPolicy): number {
    return policy.baseDelayMs * Math.pow(2, attempt);
  }
}
