import { connect } from 'nats';

export type LagSnapshot = {
  pending: number;
  ackPending: number;
  delivered: number;
  ts: string;
};

export type LagTrend = {
  points: LagSnapshot[];
  deltaPending: number;
  deltaAckPending: number;
  ratePerMin: number;
};

export class JetStreamLagMetrics {
  private streamName = process.env.JS_STREAM_NAME || 'EXECUTION';
  private consumerName = process.env.JS_CONSUMER_NAME || 'execution-worker';
  private static history: LagSnapshot[] = [];
  private static lastRecordedAt = 0;
  private static maxHistory = Number(process.env.JS_LAG_HISTORY || 30);
  private static minIntervalMs = Number(process.env.JS_LAG_MIN_INTERVAL_MS || 1000);

  async getLag(): Promise<any | null> {
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

  async getLagSnapshot(): Promise<LagSnapshot | null> {
    const info = await this.getLag();
    if (!info) return null;
    return {
      pending: info.num_pending ?? 0,
      ackPending: info.num_ack_pending ?? 0,
      delivered: info.delivered?.consumer_seq ?? 0,
      ts: new Date().toISOString()
    };
  }

  async getLagTrend(): Promise<LagTrend | null> {
    const snapshot = await this.getLagSnapshot();
    if (!snapshot) return null;

    const now = Date.now();
    if (now - JetStreamLagMetrics.lastRecordedAt >= JetStreamLagMetrics.minIntervalMs) {
      JetStreamLagMetrics.history.push(snapshot);
      JetStreamLagMetrics.lastRecordedAt = now;
      if (JetStreamLagMetrics.history.length > JetStreamLagMetrics.maxHistory) {
        JetStreamLagMetrics.history.splice(0, JetStreamLagMetrics.history.length - JetStreamLagMetrics.maxHistory);
      }
    }

    const points = JetStreamLagMetrics.history.slice();
    if (points.length < 2) {
      return { points, deltaPending: 0, deltaAckPending: 0, ratePerMin: 0 };
    }

    const prev = points[points.length - 2];
    const last = points[points.length - 1];
    if (!prev || !last) {
      return { points, deltaPending: 0, deltaAckPending: 0, ratePerMin: 0 };
    }
    const deltaPending = last.pending - prev.pending;
    const deltaAckPending = last.ackPending - prev.ackPending;
    const dtMs = Math.max(1, new Date(last.ts).getTime() - new Date(prev.ts).getTime());
    const ratePerMin = (deltaPending / dtMs) * 60000;

    return { points, deltaPending, deltaAckPending, ratePerMin };
  }
}
