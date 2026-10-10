export class VaultRetry {
  async withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 200): Promise<T> {
    let lastError: any;
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }
}
