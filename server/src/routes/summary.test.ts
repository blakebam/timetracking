import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { openDb } from '../db/connection';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp({ db: openDb(':memory:') });
});

async function create(date: string, startTime: string, endTime: string, taskName: string) {
  const res = await request(app)
    .post('/api/entries')
    .send({ date, startTime, endTime, taskName, notes: null });
  expect(res.status).toBe(201);
}

describe('GET /api/summary', () => {
  it('totals seeded entries per task and per day', async () => {
    await create('2026-10-26', '09:00', '13:00', 'API refactor');
    await create('2026-10-26', '13:00', '14:00', 'meeting');
    await create('2026-10-27', '09:00', '15:30', 'API refactor');
    await create('2026-10-27', '15:30', '16:00', 'Meeting');
    await create('2026-11-01', '09:00', '10:00', 'Outside');

    const res = await request(app).get('/api/summary?from=2026-10-26&to=2026-10-31');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      from: '2026-10-26',
      to: '2026-10-31',
      totalMinutes: 720,
      tasks: [
        {
          taskName: 'API refactor',
          minutes: 630,
          firstWorked: { date: '2026-10-26', startTime: '09:00' },
        },
        {
          taskName: 'Meeting',
          minutes: 90,
          firstWorked: { date: '2026-10-26', startTime: '13:00' },
        },
      ],
    });
    expect(res.body.days).toHaveLength(6);
    expect(res.body.days.map((d: { minutes: number }) => d.minutes)).toEqual([
      300, 420, 0, 0, 0, 0,
    ]);
    expect(res.body.days[2]).toEqual({ date: '2026-10-28', minutes: 0, tasks: [] });
  });

  it.each(['from=2026-10-31&to=2026-10-26', 'from=2026-01-01&to=2027-01-02', 'to=2026-10-26'])(
    'rejects bad range %s',
    async (query) => {
      const res = await request(app).get(`/api/summary?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation');
    },
  );
});
