import type { TimeEntry } from '@tt/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { openDb } from '../db/connection';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp({ db: openDb(':memory:') });
});

const body = (overrides: Record<string, unknown> = {}) => ({
  date: '2026-10-17',
  startTime: '09:00',
  endTime: '10:00',
  taskName: 'Meeting',
  notes: null,
  ...overrides,
});

async function create(overrides: Record<string, unknown> = {}): Promise<TimeEntry> {
  const res = await request(app).post('/api/entries').send(body(overrides));
  expect(res.status).toBe(201);
  return res.body;
}

const listDay = async (date = '2026-10-17'): Promise<TimeEntry[]> =>
  (await request(app).get(`/api/entries?from=${date}&to=${date}`)).body;

describe('entries CRUD', () => {
  it('creates, reads, updates and deletes', async () => {
    const created = await create({ taskName: '  Team   meeting ', notes: '  ' });
    expect(created).toMatchObject({ taskName: 'Team meeting', notes: null });

    const got = await request(app).get(`/api/entries/${created.id}`);
    expect(got.status).toBe(200);
    expect(got.body).toEqual(created);

    const put = await request(app)
      .put(`/api/entries/${created.id}`)
      .send(body({ startTime: '13:00', endTime: '14:30', taskName: 'Review' }));
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ id: created.id, startTime: '13:00', taskName: 'Review' });

    const del = await request(app).delete(`/api/entries/${created.id}`);
    expect(del.status).toBe(204);
    expect((await request(app).get(`/api/entries/${created.id}`)).status).toBe(404);
  });

  it('lists an inclusive range sorted by date then start', async () => {
    await create({ date: '2026-10-03', startTime: '13:00', endTime: '14:00', taskName: 'C' });
    await create({ date: '2026-10-01', taskName: 'A' });
    await create({ date: '2026-10-03', startTime: '08:00', endTime: '09:00', taskName: 'B' });
    await create({ date: '2026-10-04', taskName: 'outside' });

    const res = await request(app).get('/api/entries?from=2026-10-01&to=2026-10-03');
    expect(res.status).toBe(200);
    expect(res.body.map((e: TimeEntry) => e.taskName)).toEqual(['A', 'B', 'C']);
  });

  it('returns 404 for unknown ids and 400 for non-numeric ids', async () => {
    expect((await request(app).get('/api/entries/999')).status).toBe(404);
    expect((await request(app).put('/api/entries/999').send(body())).status).toBe(404);
    expect((await request(app).delete('/api/entries/999')).status).toBe(404);

    const bad = await request(app).get('/api/entries/abc');
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ error: 'validation', issues: [{ path: 'id' }] });
  });
});

describe('validation', () => {
  it('reports field issues with human-readable messages', async () => {
    const res = await request(app)
      .post('/api/entries')
      .send(body({ startTime: '10:00', endTime: '09:00' }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'validation',
      issues: [{ path: 'endTime', message: 'End time must be after start time' }],
    });
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/api/entries')
      .set('Content-Type', 'application/json')
      .send('{"date": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'validation',
      issues: [{ path: '', message: 'Request body is not valid JSON' }],
    });
  });

  it.each([
    'from=2026-10-18&to=2026-10-17',
    'from=2026-01-01&to=2027-01-02',
    'from=2026-10-17',
    'from=bad&to=2026-10-17',
  ])('rejects bad range %s', async (query) => {
    expect((await request(app).get(`/api/entries?${query}`)).status).toBe(400);
  });
});

describe('overlaps', () => {
  it('rejects an overlapping POST with 409 and saves nothing', async () => {
    const existing = await create();
    const res = await request(app)
      .post('/api/entries')
      .send(body({ startTime: '09:30', endTime: '10:30', taskName: 'Other' }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'overlap',
      message:
        '9:30 AM – 10:30 AM overlaps "Meeting" (9:00 AM – 10:00 AM) on Sat, Oct 17. ' +
        'Change the times on one of the two entries.',
      conflicts: [existing],
    });
    expect(await listDay()).toHaveLength(1);
  });

  it('rejects an overlapping PUT with 409 and leaves the entry unchanged', async () => {
    await create();
    const other = await create({ startTime: '11:00', endTime: '12:00', taskName: 'Other' });

    const res = await request(app)
      .put(`/api/entries/${other.id}`)
      .send(body({ startTime: '09:45', endTime: '12:00', taskName: 'Other' }));
    expect(res.status).toBe(409);
    expect((await request(app).get(`/api/entries/${other.id}`)).body).toEqual(other);
  });

  it('allows touching entries', async () => {
    await create();
    const res = await request(app)
      .post('/api/entries')
      .send(body({ startTime: '10:00', endTime: '11:00' }));
    expect(res.status).toBe(201);
  });

  it('allows re-saving an entry with its own times', async () => {
    const existing = await create();
    const res = await request(app)
      .put(`/api/entries/${existing.id}`)
      .send(body({ notes: 'edited' }));
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('edited');
  });
});

describe('GET /api/tasks/names', () => {
  it('filters case-insensitively and dedupes', async () => {
    await create({ date: '2026-10-01', taskName: 'meetings' });
    await create({ date: '2026-10-02', taskName: 'Report Writing' });
    await create({ date: '2026-10-03', taskName: 'Meetings' });

    expect((await request(app).get('/api/tasks/names')).body).toEqual([
      'Meetings',
      'Report Writing',
    ]);
    expect((await request(app).get('/api/tasks/names?q=MEE')).body).toEqual(['Meetings']);
    expect((await request(app).get('/api/tasks/names?limit=1')).body).toEqual(['Meetings']);
    expect((await request(app).get('/api/tasks/names?limit=0')).status).toBe(400);
  });
});
