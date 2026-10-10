import { connect, NatsConnection, StringCodec } from 'nats';
import { NatsRetry } from './NatsRetry';

export class NatsClient {
  private nc: NatsConnection | null = null;
  private sc = StringCodec();
  private retry = new NatsRetry();

  async connect(url?: string): Promise<boolean> {
    if (!url) return false;
    if (this.nc) return true;
    this.nc = await this.retry.withRetry(() => connect({
      servers: url,
      maxReconnectAttempts: 10,
      reconnectTimeWait: 1000
    }));
    return true;
  }

  isReady(): boolean {
    return !!this.nc;
  }

  publish(subject: string, payload: string): void {
    if (!this.nc) return;
    this.nc.publish(subject, this.sc.encode(payload));
  }

  async subscribe(subject: string, handler: (data: string) => Promise<void>): Promise<void> {
    if (!this.nc) return;
    const sub = this.nc.subscribe(subject);
    for await (const msg of sub) {
      const data = this.sc.decode(msg.data);
      await handler(data);
    }
  }
}
