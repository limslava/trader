import { connect } from 'nats';

export class QueueMetrics {
  private streamName = process.env.JS_STREAM_NAME || 'EXECUTION';
  private consumerName = process.env.JS_CONSUMER_NAME || 'execution-worker';

  async streamInfo(): Promise<any | null> {
    const url = process.env.NATS_URL;
    if (!url) return null;

    const nc = await connect({ servers: url });
    const jsm = await nc.jetstreamManager();
    try {
      const info = await jsm.streams.info(this.streamName);
      await nc.close();
      return info;
    } catch (_error) {
      await nc.close();
      return null;
    }
  }

  async consumerInfo(): Promise<any | null> {
    const url = process.env.NATS_URL;
    if (!url) return null;

    const nc = await connect({ servers: url });
    const jsm = await nc.jetstreamManager();
    try {
      const info = await jsm.consumers.info(this.streamName, this.consumerName);
      await nc.close();
      return info;
    } catch (_error) {
      await nc.close();
      return null;
    }
  }
}
