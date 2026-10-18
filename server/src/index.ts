import { APP_NAME } from '@tt/shared';
import { createApp } from './app';
import { config } from './config';
import { openDb, type Db } from './db/connection';

let db: Db;
try {
  db = openDb(config.dbPath);
} catch (err) {
  console.error(`Could not open database at ${config.dbPath}:`);
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const app = createApp({
  db,
  clientDistDir: config.isProduction ? config.clientDistDir : undefined,
});

const server = app.listen(config.port, config.host, () => {
  console.log(`${APP_NAME} server listening on http://${config.host}:${config.port}`);
  console.log(`Database: ${config.dbPath}`);
});

server.on('error', (err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

function shutdown() {
  server.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
