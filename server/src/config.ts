import path from 'node:path';
import { fileURLToPath } from 'node:url';

// src/ in dev and dist/ in prod both sit one level below the server package and two below the repo root.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(moduleDir, '..');
const repoRoot = path.resolve(serverRoot, '..');
const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '127.0.0.1',
  dbPath: process.env.DB_PATH ?? path.join(repoRoot, 'data', 'timetracking.db'),
  clientDistDir: path.join(repoRoot, 'client', 'dist'),
  // The build copies assets/ into dist/ (tsup publicDir), so dist/ carries its own fonts.
  fontsDir: isProduction ? path.join(moduleDir, 'fonts') : path.join(serverRoot, 'assets', 'fonts'),
  isProduction,
};
