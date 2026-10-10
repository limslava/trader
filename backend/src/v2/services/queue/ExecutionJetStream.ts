import { connect, StringCodec, consumerOpts } from 'nats';
import { JetStreamProvisioner } from './JetStreamProvisioner';

export class ExecutionJetStream {
  private subject = 'execution.queue';
  private durable = 'execution-worker';
  private sc = StringCodec();
  private ready = false;
  private handler: ((orderId: string) => Promise<void>) | null = null;
  private provisioner = new JetStreamProvisioner();
  private retryAttempts = 3;
  private healthOk = true;

  async init(handler: (orderId: string) => Promise<void>): Promise<boolean> {
    const url = process.env.NATS_URL;
    if (!url) return false;

    this.handler = handler;

    await this.withRetry(async () => {
      await this.provisioner.ensureStream();
    });

    const nc = await this.withRetry(async () => connect({ servers: url }));
    const js = nc.jetstream();

    const opts = consumerOpts();
    opts.durable(this.durable);
    opts.manualAck();
    opts.ackExplicit();
    opts.deliverTo(`deliver.${this.durable}`);

    const sub = await this.withRetry(async () => js.subscribe(this.subject, opts));
    (async () => {
      for await (const msg of sub) {
        const data = this.sc.decode(msg.data);
        if (this.handler) {
          await this.handler(data);
        }
        msg.ack();
      }
    })();

    this.ready = true;
    return true;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    for (let i = 0; i < this.retryAttempts; i += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        this.healthOk = false;
        if (i < this.retryAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
        }
      }
    }
    throw lastError;
  }

  isHealthy(): boolean {
    return this.healthOk;
  }

  isReady(): boolean {
    return this.ready;
  }
}
