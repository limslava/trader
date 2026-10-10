export class ExecutionErrorClassifier {
  private retryablePatterns = [
    'timeout',
    'timed out',
    'etimedout',
    'econnreset',
    'socket hang up',
    'temporarily',
    'unavailable',
    'rate limit',
    'too many requests',
    '429',
    'bad gateway',
    'gateway timeout',
    'service unavailable',
    'internal server error',
    'self-signed certificate',
    'certificate'
  ];

  isRetryable(message?: string | null): boolean {
    if (!message) return false;
    const text = message.toLowerCase();
    return this.retryablePatterns.some((pattern) => text.includes(pattern));
  }
}
