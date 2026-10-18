import type { Invoice, SettingsInput } from '@tt/shared';
import { SEPTEMBER_2026_ENTRIES, SEPTEMBER_2026_SETTINGS } from '@tt/shared/fixtures/september2026';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { openDb, type Db } from '../db/connection';
import { pdfText } from '../pdf/pdfText';

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp({ db });
});

async function putSettings(changes: Partial<SettingsInput> = {}) {
  const res = await request(app)
    .put('/api/settings')
    .send({ ...SEPTEMBER_2026_SETTINGS, ...changes });
  expect(res.status).toBe(200);
}

/** The September 2026 example: settings with next invoice 25, and 49 hours of entries. */
async function seedExample() {
  await putSettings();
  for (const entry of SEPTEMBER_2026_ENTRIES) {
    const res = await request(app).post('/api/entries').send(entry);
    expect(res.status).toBe(201);
  }
}

async function addEntry(date: string, taskName = 'Meetings') {
  const res = await request(app)
    .post('/api/entries')
    .send({ date, startTime: '09:00', endTime: '10:00', taskName, notes: null });
  expect(res.status).toBe(201);
  return res.body.id as number;
}

async function issue(month: string, invoiceDate = '2026-10-01') {
  return request(app).post('/api/invoices').send({ month, invoiceDate });
}

const nextInvoiceNumber = async () =>
  (await request(app).get('/api/settings')).body.nextInvoiceNumber as number;

describe('GET /api/invoices/draft', () => {
  it('builds the example invoice from live data, dated the 1st of the next month', async () => {
    await seedExample();
    const res = await request(app).get('/api/invoices/draft?month=2026-09');
    expect(res.status).toBe(200);
    expect(res.body.problems).toEqual([]);
    expect(res.body.issued).toBeNull();
    expect(res.body.draft).toMatchObject({
      invoiceNumber: 25,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      invoiceDate: '2026-10-01',
      totalMinutes: 49 * 60,
      amountCents: 49_000,
      paymentTerms: 'On Receipt',
    });
    expect(res.body.draft.lines).toHaveLength(7);
    expect(res.body.draft.lines[0]).toEqual({
      taskName: 'Meetings',
      minutes: 180,
      rateCents: 1000,
      amountCents: 3_000,
    });
  });

  it('uses the invoice date given', async () => {
    const res = await request(app).get('/api/invoices/draft?month=2026-09&invoiceDate=2026-10-05');
    expect(res.body.draft.invoiceDate).toBe('2026-10-05');
  });

  it('reports missing settings and an empty month', async () => {
    const res = await request(app).get('/api/invoices/draft?month=2026-09');
    expect(res.body.problems).toEqual([
      'Set your name in Settings',
      'Set the company name in Settings',
      'Set an hourly rate in Settings',
      'No time logged in September 2026',
    ]);
  });

  it('reports an already-invoiced month and returns the issued invoice', async () => {
    await seedExample();
    const issued = (await issue('2026-09')).body as Invoice;

    const res = await request(app).get('/api/invoices/draft?month=2026-09');
    expect(res.body.problems).toEqual(['September 2026 was already invoiced as INV0025']);
    expect(res.body.issued).toEqual(issued);
    expect(res.body.draft.invoiceNumber).toBe(26);
  });

  it.each(['', 'month=2026-13', 'month=2026-9', 'month=2026-09&invoiceDate=2026-02-30'])(
    'rejects a bad query "%s"',
    async (query) => {
      const res = await request(app).get(`/api/invoices/draft?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation');
    },
  );
});

describe('POST /api/invoices', () => {
  it('issues the next number, snapshots the draft and increments the number', async () => {
    await seedExample();
    const res = await issue('2026-09', '2026-10-02');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      invoiceNumber: 25,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      invoiceDate: '2026-10-02',
      totalMinutes: 2940,
      amountCents: 49_000,
      biller: { name: 'Jane Doe', email: 'jane.doe@example.com' },
      company: { name: 'Example Company LLC' },
    });
    expect(res.body.lines).toHaveLength(7);
    expect(typeof res.body.id).toBe('number');
    expect(typeof res.body.issuedAt).toBe('string');
    expect(await nextInvoiceNumber()).toBe(26);

    const got = await request(app).get(`/api/invoices/${res.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body).toEqual(res.body);
  });

  it('refuses to invoice the same month twice', async () => {
    await seedExample();
    const first = await issue('2026-09');
    const second = await issue('2026-09');
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: 'invoice_exists', invoice: first.body });
    expect(await nextInvoiceNumber()).toBe(26);
  });

  it('refuses with 400 while the draft has problems', async () => {
    await putSettings({ hourlyRateCents: 0 });
    const res = await issue('2026-09');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'validation',
      issues: [
        { path: '', message: 'Set an hourly rate in Settings' },
        { path: '', message: 'No time logged in September 2026' },
      ],
    });
    expect((await request(app).get('/api/invoices')).body).toEqual([]);
    expect(await nextInvoiceNumber()).toBe(25);
  });

  it('validates the body', async () => {
    const res = await request(app).post('/api/invoices').send({ month: '2026-09' });
    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe('invoiceDate');
  });

  it('keeps the issued invoice unchanged after entries and settings change', async () => {
    await seedExample();
    const issued = (await issue('2026-09')).body as Invoice;

    const id = await addEntry('2026-09-15', 'Report Writing');
    const extra = await request(app).put(`/api/entries/${id}`).send({
      date: '2026-09-15',
      startTime: '09:00',
      endTime: '11:00',
      taskName: 'New Task',
      notes: null,
    });
    expect(extra.status).toBe(200);
    await putSettings({
      billerName: 'Someone Else',
      companyName: 'Other Co',
      hourlyRateCents: 5000,
      paymentTerms: 'Net 30',
      nextInvoiceNumber: 40,
    });

    expect((await request(app).get(`/api/invoices/${issued.id}`)).body).toEqual(issued);

    // The draft for the month reflects the live data, so the UI can warn about the difference.
    const draft = await request(app).get('/api/invoices/draft?month=2026-09');
    expect(draft.body.issued).toEqual(issued);
    expect(draft.body.draft.totalMinutes).toBe(2940 + 120);
  });

  it('writes nothing if issuing fails partway', async () => {
    await seedExample();
    db.exec(`CREATE TRIGGER fail_settings BEFORE UPDATE ON settings
             BEGIN SELECT RAISE(ABORT, 'forced failure'); END`);

    const res = await issue('2026-09');
    expect(res.status).toBe(500);
    expect(db.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM invoice_lines').get()).toEqual({ n: 0 });
    expect(await nextInvoiceNumber()).toBe(25);
  });
});

describe('GET /api/invoices', () => {
  it('lists issued invoices, newest first', async () => {
    await seedExample();
    await addEntry('2026-10-05');
    const sept = (await issue('2026-09')).body as Invoice;
    const oct = (await issue('2026-10', '2026-11-01')).body as Invoice;

    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: oct.id,
        invoiceNumber: 26,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        invoiceDate: '2026-11-01',
        totalMinutes: 60,
        amountCents: 1000,
      },
      {
        id: sept.id,
        invoiceNumber: 25,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        invoiceDate: '2026-10-01',
        totalMinutes: 2940,
        amountCents: 49_000,
      },
    ]);
  });

  it('returns 404 for an unknown invoice', async () => {
    expect((await request(app).get('/api/invoices/99')).status).toBe(404);
  });
});

describe('DELETE /api/invoices/:id', () => {
  it('deletes the latest invoice and hands its number back', async () => {
    await seedExample();
    const sept = (await issue('2026-09')).body as Invoice;

    const res = await request(app).delete(`/api/invoices/${sept.id}`);
    expect(res.status).toBe(204);
    expect(await nextInvoiceNumber()).toBe(25);
    expect((await request(app).get(`/api/invoices/${sept.id}`)).status).toBe(404);
    expect(db.prepare('SELECT COUNT(*) AS n FROM invoice_lines').get()).toEqual({ n: 0 });

    // Re-issuing reuses the number.
    expect((await issue('2026-09')).body.invoiceNumber).toBe(25);
  });

  it('refuses to delete an older invoice', async () => {
    await seedExample();
    await addEntry('2026-10-05');
    const sept = (await issue('2026-09')).body as Invoice;
    await issue('2026-10', '2026-11-01');

    const res = await request(app).delete(`/api/invoices/${sept.id}`);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'not_latest',
      message: 'Only the most recent invoice (INV0026) can be deleted.',
    });
    expect(await nextInvoiceNumber()).toBe(27);
  });

  it('returns 404 for an unknown invoice', async () => {
    expect((await request(app).delete('/api/invoices/99')).status).toBe(404);
  });
});

const getPdf = (url: string) => request(app).get(url).responseType('blob');

describe('GET /api/invoices/draft.pdf', () => {
  it('previews the draft with a watermark and the next number', async () => {
    await seedExample();
    const res = await getPdf(
      '/api/invoices/draft.pdf?month=2026-09&invoiceDate=2026-10-05&inline=1',
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'inline; filename="September_2026_Invoice.pdf"',
    );
    const [text] = await pdfText(res.body);
    expect(text).toMatch(/^DRAFT Jane Doe /);
    expect(text).toContain('INVOICE INV0025 DATE October 5, 2026');
    expect(text).toMatch(/TOTAL 49 Hours USD \$490\.00$/);
  });

  it('renders even when the draft has problems', async () => {
    const res = await getPdf('/api/invoices/draft.pdf?month=2026-08');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="August_2026_Invoice.pdf"',
    );
    expect((await pdfText(res.body))[0]).toMatch(/TOTAL 0 Hours USD \$0\.00$/);
  });

  it('rejects a bad month', async () => {
    const res = await request(app).get('/api/invoices/draft.pdf?month=2026-13');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });
});

describe('GET /api/invoices/:id/pdf', () => {
  it('renders the issued snapshot, unaffected by later changes', async () => {
    await seedExample();
    const issued = (await issue('2026-09')).body as Invoice;
    await putSettings({ billerName: 'Someone Else', hourlyRateCents: 5000, nextInvoiceNumber: 30 });
    await addEntry('2026-09-15');

    const res = await getPdf(`/api/invoices/${issued.id}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="September_2026_Invoice.pdf"',
    );
    const [text] = await pdfText(res.body);
    expect(text).toMatch(/^Jane Doe /);
    expect(text).toContain('INVOICE INV0025 DATE October 1, 2026');
    expect(text).toMatch(/Meetings \$10\.00 3 \$30\.00 .* TOTAL 49 Hours USD \$490\.00$/);
  });

  it('404s for an unknown invoice', async () => {
    const res = await request(app).get('/api/invoices/999/pdf');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});

describe('PUT /api/settings with issued invoices', () => {
  it('rejects a next invoice number at or below the highest issued one', async () => {
    await seedExample();
    await issue('2026-09');

    const res = await request(app)
      .put('/api/settings')
      .send({ ...SEPTEMBER_2026_SETTINGS, nextInvoiceNumber: 25 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'validation',
      issues: [
        {
          path: 'nextInvoiceNumber',
          message: 'Invoice INV0025 has already been issued; the next number must be 26 or higher.',
        },
      ],
    });
    expect(await nextInvoiceNumber()).toBe(26);

    await putSettings({ nextInvoiceNumber: 30 });
    expect(await nextInvoiceNumber()).toBe(30);
  });
});
