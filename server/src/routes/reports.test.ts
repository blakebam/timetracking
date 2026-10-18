import { SEPTEMBER_2026_ENTRIES } from '@tt/shared/fixtures/september2026';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { openDb } from '../db/connection';
import { pdfText } from '../pdf/pdfText';

let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  app = createApp({ db: openDb(':memory:') });
  for (const entry of SEPTEMBER_2026_ENTRIES) {
    expect((await request(app).post('/api/entries').send(entry)).status).toBe(201);
  }
});

const getPdf = (url: string) => request(app).get(url).responseType('blob');

describe('GET /api/reports/timesheet.pdf', () => {
  it('downloads the timesheet for the period containing start', async () => {
    const res = await getPdf('/api/reports/timesheet.pdf?start=2026-09-03');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="09-01_09-06_Timesheet.pdf"',
    );
    expect(await pdfText(res.body)).toEqual([
      '9/1-9/6 Weekly Timesheet Items Hours Meetings 1 Report Writing 16.5 ' +
        'Data Entry 0.5 Total 18',
    ]);
  });

  it('cuts the period at the month end and exports empty periods', async () => {
    const end = await getPdf('/api/reports/timesheet.pdf?start=2026-09-28');
    expect(end.headers['content-disposition']).toContain('filename="09-28_09-30_Timesheet.pdf"');

    const empty = await getPdf('/api/reports/timesheet.pdf?start=2026-09-14');
    expect(empty.status).toBe(200);
    expect(empty.headers['content-disposition']).toContain('filename="09-14_09-20_Timesheet.pdf"');
    expect(await pdfText(empty.body)).toEqual(['9/14-9/20 Weekly Timesheet Items Hours Total 0']);
  });

  it('serves inline with ?inline=1', async () => {
    const res = await getPdf('/api/reports/timesheet.pdf?start=2026-09-01&inline=1');
    expect(res.headers['content-disposition']).toBe('inline; filename="09-01_09-06_Timesheet.pdf"');
  });

  it.each(['', 'start=2026-02-30', 'start=2026-09-01&inline=yes'])(
    'rejects a bad query "%s" with the usual JSON error',
    async (query) => {
      const res = await request(app).get(`/api/reports/timesheet.pdf?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation');
    },
  );
});
