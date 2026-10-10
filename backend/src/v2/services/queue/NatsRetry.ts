export class NatsRetry {
  async withRetry<T>(
    fn: () => Promise<T>,
    attempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < attempts - 1) {
          const jitter = Math.floor(Math.random() * 250);
          const delay = Math.min(baseDelayMs * (i + 1) + jitter, maxDelayMs);
          console.warn(`NATS retry ${i + 1}/${attempts} in ${delay}ms`, error);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }
}
