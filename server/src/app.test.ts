import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb } from './db/connection';

describe('createApp', () => {
  it('responds to the health check', async () => {
    const res = await request(createApp({ db: openDb(':memory:') })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(createApp({ db: openDb(':memory:') })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  describe('serving the built client', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-client-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>spa</title>');
    fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1)');
    const app = createApp({ db: openDb(':memory:'), clientDistDir: dir });

    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('serves static assets', async () => {
      const res = await request(app).get('/app.js');
      expect(res.status).toBe(200);
      expect(res.text).toContain('console.log');
    });

    it('falls back to index.html for client routes', async () => {
      const res = await request(app).get('/calendar');
      expect(res.status).toBe(200);
      expect(res.text).toContain('<title>spa</title>');
    });

    it('still returns 404 JSON for unknown API routes', async () => {
      const res = await request(app).get('/api/nope');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'not_found' });
    });
  });
});
