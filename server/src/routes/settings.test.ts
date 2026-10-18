import type { SettingsInput } from '@tt/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { openDb } from '../db/connection';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp({ db: openDb(':memory:') });
});

const input: SettingsInput = {
  billerName: 'Jane Doe',
  billerAddress: '123 Main St\nSpringfield TX\n75000',
  billerPhone: '555-555-5555',
  billerEmail: 'jane@example.com',
  companyName: 'Acme LLC',
  companyAddress: '',
  hourlyRateCents: 1000,
  paymentTerms: 'On Receipt',
  nextInvoiceNumber: 26,
  defaultStartTime: '08:30',
};

describe('settings API', () => {
  it('returns the defaults on a fresh database', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      billerName: '',
      billerEmail: '',
      companyName: '',
      hourlyRateCents: 0,
      paymentTerms: 'On Receipt',
      nextInvoiceNumber: 1,
      defaultStartTime: '11:00',
    });
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('round-trips a full replace', async () => {
    const put = await request(app).put('/api/settings').send(input);
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject(input);

    const got = await request(app).get('/api/settings');
    expect(got.body).toEqual(put.body);
  });

  it('normalizes text before saving', async () => {
    const put = await request(app)
      .put('/api/settings')
      .send({
        ...input,
        billerName: '  Jane Doe ',
        billerAddress: ' 123 Main St  \r\nSpringfield ',
      });
    expect(put.body).toMatchObject({
      billerName: 'Jane Doe',
      billerAddress: '123 Main St\nSpringfield',
    });
  });

  it('rejects a bad body with field issues and leaves settings unchanged', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({
        ...input,
        billerEmail: 'not-an-email',
        defaultStartTime: '08:10',
        hourlyRateCents: 35.5,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
    expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual([
      'billerEmail',
      'defaultStartTime',
      'hourlyRateCents',
    ]);

    expect((await request(app).get('/api/settings')).body.billerName).toBe('');
  });

  it('requires every field (full replace)', async () => {
    const { paymentTerms: _omitted, ...partial } = input;
    const res = await request(app).put('/api/settings').send(partial);
    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe('paymentTerms');
  });
});
