export class CryptoCircuitBreaker {
  private failCount = 0;
  private openUntil = 0;

  constructor(private threshold = 5, private openMs = 10_000) {}

  isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  onSuccess(): void {
    this.failCount = 0;
    this.openUntil = 0;
  }

  onFailure(): void {
    this.failCount += 1;
    if (this.failCount >= this.threshold) {
      this.openUntil = Date.now() + this.openMs;
    }
  }
}
