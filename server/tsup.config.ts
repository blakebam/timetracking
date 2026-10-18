import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  // Shared is consumed as TS source, so it must be bundled in; real npm deps stay external.
  noExternal: ['@tt/shared'],
  env: { NODE_ENV: 'production' },
  // Copies the contents of assets/ (the PDF fonts) into dist/, so the build is self-contained.
  publicDir: 'assets',
});
