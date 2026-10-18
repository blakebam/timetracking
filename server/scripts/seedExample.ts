/**
 * Writes data/example.db (or the path given as the first argument) with the September 2026
 * example: settings and entries whose timesheets and invoice match the reference PDFs. Any
 * existing file at that path is replaced. Run the app against it with DB_PATH=data/example.db.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEPTEMBER_2026_ENTRIES, SEPTEMBER_2026_SETTINGS } from '@tt/shared/fixtures/september2026';
import { openDb } from '../src/db/connection';
import { entriesRepo } from '../src/db/entriesRepo';
import { settingsRepo } from '../src/db/settingsRepo';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = path.resolve(process.argv[2] ?? path.join(repoRoot, 'data', 'example.db'));

fs.rmSync(file, { force: true });
const db = openDb(file);
try {
  db.transaction(() => {
    settingsRepo(db).update(SEPTEMBER_2026_SETTINGS);
    const entries = entriesRepo(db);
    for (const entry of SEPTEMBER_2026_ENTRIES) entries.create(entry);
  })();
} finally {
  db.close();
}

console.log(`Seeded ${SEPTEMBER_2026_ENTRIES.length} September 2026 entries into ${file}`);
