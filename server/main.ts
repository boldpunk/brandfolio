/**
 * Server entry: `node server.mjs` starts the API; `node server.mjs grant …`
 * changes a user's plan from the console.
 */
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { runCli } from './cli';
import { readConfig } from './config';
import { Store } from './store';

const config = readConfig();
const args = process.argv.slice(2);

if (args.length > 0) {
  process.exitCode = runCli(args, config);
} else {
  const store = new Store(config.dataDir);
  const app = createApp({ store, adminEmails: config.adminEmails, secureCookie: config.production });
  store.deleteExpiredSessions(new Date());
  const cleanup = setInterval(() => store.deleteExpiredSessions(new Date()), 6 * 3_600_000);
  cleanup.unref();

  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    console.log(`Brandfolio API on http://${config.host}:${info.port} (data: ${config.dataDir})`);
  });

  const shutdown = () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
