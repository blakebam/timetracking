import { defineConfig } from 'vitest/config';

// A fixed US zone, so date tests cross real DST transitions (2026-03-08, 2026-11-01) on any
// machine. Set here, before workers start, because module-level Intl formatters read it on import.
process.env.TZ = 'America/Chicago';

export default defineConfig({
  test: {
    projects: ['shared', 'server', 'client'],
    passWithNoTests: true,
  },
});
