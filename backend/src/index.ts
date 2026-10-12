import { createApp } from './app.js';
import { config } from './config.js';
import { migrate, pool } from './db.js';
import { scheduleWeeklyDigest } from './digest.js';

await migrate();
scheduleWeeklyDigest();

const server = createApp().listen(config.PORT, () => {
  console.log(`Trader API listening on http://localhost:${config.PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => void pool.end().then(() => process.exit(0)));
    // Docker sends SIGKILL after 10 s; don't let a slow AI call keep us alive past that.
    setTimeout(() => process.exit(0), 8_000).unref();
  });
}
