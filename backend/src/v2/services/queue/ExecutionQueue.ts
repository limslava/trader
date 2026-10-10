import { NatsClient } from './NatsClient';

export class ExecutionQueue {
  private subject = 'execution.queue';
  private client = new NatsClient();

  async init(): Promise<void> {
    await this.client.connect(process.env.NATS_URL);
  }

  publish(orderId: string): void {
    if (!this.client.isReady()) return;
    this.client.publish(this.subject, orderId);
  }

  async consume(handler: (orderId: string) => Promise<void>): Promise<void> {
    if (!this.client.isReady()) return;
    await this.client.subscribe(this.subject, handler);
  }

  isReady(): boolean {
    return this.client.isReady();
  }
}
