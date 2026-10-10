export class QueueAlertThrottle {
  private lastSentAt: number = 0;

  shouldSend(cooldownMs = 60000): boolean {
    const now = Date.now();
    if (now - this.lastSentAt < cooldownMs) return false;
    this.lastSentAt = now;
    return true;
  }
}
