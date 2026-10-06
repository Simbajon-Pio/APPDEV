import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT || 5000);
const server = app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`eBarangayMo API listening on port ${port}\n`);
});

async function shutdown() {
  server.close(async () => {
    try { await app.locals.sessionStore.close(); } catch {}
    try { await app.locals.pool.end(); } catch {}
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
