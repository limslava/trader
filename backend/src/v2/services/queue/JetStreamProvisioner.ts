import { connect, DiscardPolicy, RetentionPolicy } from 'nats';

export class JetStreamProvisioner {
  async ensureStream(): Promise<void> {
    const url = process.env.NATS_URL;
    if (!url) return;

    const nc = await connect({ servers: url });
    const jsm = await nc.jetstreamManager();

    const streamName = process.env.JS_STREAM_NAME || 'EXECUTION';
    const maxMsgs = Number(process.env.JS_MAX_MSGS || 1_000_000);
    const maxBytes = Number(process.env.JS_MAX_BYTES || 1_000_000_000);
    const maxAgeSec = Number(process.env.JS_MAX_AGE_SEC || 7 * 24 * 3600);
    const maxAge = maxAgeSec * 1_000_000_000;
    const maxConsumers = Number(process.env.JS_MAX_CONSUMERS || -1);

    try {
      const info = await jsm.streams.info(streamName);
      const desired = {
        ...info.config,
        retention: RetentionPolicy.Limits,
        discard: DiscardPolicy.Old,
        max_msgs_per_subject: -1,
        max_msgs: maxMsgs,
        max_bytes: maxBytes,
        max_age: maxAge,
        max_consumers: maxConsumers
      };
      const needsUpdate =
        info.config.retention !== desired.retention ||
        info.config.discard !== desired.discard ||
        info.config.max_msgs !== desired.max_msgs ||
        info.config.max_bytes !== desired.max_bytes ||
        info.config.max_age !== desired.max_age ||
        info.config.max_consumers !== desired.max_consumers;
      if (needsUpdate) {
        await jsm.streams.update(streamName, desired);
      }
    } catch (_error) {
      await jsm.streams.add({
        name: streamName,
        subjects: ['execution.queue'],
        retention: RetentionPolicy.Limits,
        discard: DiscardPolicy.Old,
        max_msgs_per_subject: -1,
        max_msgs: maxMsgs,
        max_bytes: maxBytes,
        max_age: maxAge,
        max_consumers: maxConsumers
      });
    }

    await nc.close();
  }
}
