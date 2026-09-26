/**
 * `npm run server:dev`: rebuilds server-dist/server.mjs on every change in
 * server/ or src/ and restarts it. DATA_DIR defaults to ./.data.
 */
import { spawn } from 'node:child_process';
import { build } from 'vite';

let child = null;

function restart() {
  if (child) {
    child.removeAllListeners('exit');
    child.kill('SIGTERM');
  }
  child = spawn(process.execPath, ['server-dist/server.mjs'], { stdio: 'inherit', env: process.env });
  child.on('exit', (code) => {
    if (code) console.error(`server exited with code ${code}; waiting for changes`);
  });
}

const watcher = await build({ configFile: 'vite.server.config.ts', build: { watch: {} }, logLevel: 'warn' });
watcher.on('event', (event) => {
  if (event.code === 'BUNDLE_END') {
    event.result?.close?.();
    console.log('server rebuilt');
    restart();
  } else if (event.code === 'ERROR') {
    console.error(event.error);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child?.kill('SIGTERM');
    watcher.close();
    process.exit(0);
  });
}
