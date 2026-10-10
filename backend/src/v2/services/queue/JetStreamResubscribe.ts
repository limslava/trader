import { ExecutionJetStream } from './ExecutionJetStream';

export class JetStreamResubscribe {
  private interval: NodeJS.Timeout | null = null;
  private attempts = 0;

  start(jetstream: ExecutionJetStream, handler: (orderId: string) => Promise<void>, intervalMs = 10000) {
    if (this.interval) return;
    this.interval = setInterval(async () => {
      if (!jetstream.isHealthy()) {
        this.attempts += 1;
        try {
          const jitter = Math.floor(Math.random() * 1000);
          const backoff = Math.min(30000, 500 * Math.pow(2, this.attempts));
          await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
          await jetstream.init(handler);
          this.attempts = 0;
        } catch (_error) {
          // swallow to avoid crash
          if (this.attempts > 10) {
            this.stop();
          }
        }
      }
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
