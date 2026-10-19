import { pool } from './db.js';
import { runMorningBrief } from './briefs.js';
import { runAll } from './arena.js';

/**
 * Admin tasks from inside the container, no login needed:
 *   docker exec trader-app-1 node backend/dist/cli.js brief   # reviews + verdicts now
 *   docker exec trader-app-1 node backend/dist/cli.js round   # arena round now
 */
const task = process.argv[2];
try {
  if (task === 'brief') console.log(JSON.stringify(await runMorningBrief(), null, 1));
  else if (task === 'round') await runAll();
  else {
    console.error('usage: cli.js brief | round');
    process.exitCode = 2;
  }
} finally {
  await pool.end();
}
