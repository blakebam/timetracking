import path from 'node:path';
import express from 'express';
import type { Db } from './db/connection';
import { entriesRepo } from './db/entriesRepo';
import { invoicesRepo } from './db/invoicesRepo';
import { settingsRepo } from './db/settingsRepo';
import { apiNotFound, errorHandler } from './middleware/errors';
import { entriesRouter } from './routes/entries';
import { invoicesRouter } from './routes/invoices';
import { reportsRouter } from './routes/reports';
import { settingsRouter } from './routes/settings';
import { summaryRouter } from './routes/summary';
import { tasksRouter } from './routes/tasks';

export interface AppOptions {
  db: Db;
  /** Serve the built client (with SPA fallback) from this directory. Production only. */
  clientDistDir?: string;
}

export function createApp({ db, clientDistDir }: AppOptions) {
  const entries = entriesRepo(db);
  const settings = settingsRepo(db);
  const invoices = invoicesRepo(db);

  const app = express();
  app.use(express.json());

  const api = express.Router();
  api.get('/health', (_req, res) => {
    db.prepare('SELECT 1').get(); // throws (→ 500) if the database is unusable
    res.json({ ok: true });
  });
  api.use('/entries', entriesRouter(entries));
  api.use('/tasks', tasksRouter(entries));
  api.use('/settings', settingsRouter(settings, invoices));
  api.use('/summary', summaryRouter(entries));
  api.use('/invoices', invoicesRouter({ db, invoices, settings, entries }));
  api.use('/reports', reportsRouter(entries));
  api.use(apiNotFound);
  app.use('/api', api);

  if (clientDistDir) {
    const indexHtml = path.join(clientDistDir, 'index.html');
    app.use(express.static(clientDistDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  app.use(errorHandler);
  return app;
}
