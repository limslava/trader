import { connect } from 'nats';

export class JetStreamHealth {
  async check(): Promise<{ ok: boolean; rttMs: number | null }> {
    const url = process.env.NATS_URL;
    if (!url) return { ok: false, rttMs: null };

    try {
      const started = Date.now();
      const nc = await connect({ servers: url });
      await nc.close();
      return { ok: true, rttMs: Date.now() - started };
    } catch (_error) {
      return { ok: false, rttMs: null };
    }
  }
}
