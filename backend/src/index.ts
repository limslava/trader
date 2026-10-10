import { createApp } from './app.js';
import { config } from './config.js';
import { migrate, pool } from './db.js';

await migrate();

const server = createApp().listen(config.PORT, () => {
  console.log(`Trader API listening on http://localhost:${config.PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => void pool.end().then(() => process.exit(0)));
  });
}
