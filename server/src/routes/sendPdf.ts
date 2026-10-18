import type { Response } from 'express';

/** Sends a PDF as a download, or with `inline` for viewing in a browser tab. */
export function sendPdf(res: Response, pdf: Buffer, filename: string, inline: boolean) {
  res
    .type('application/pdf')
    .set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`)
    .send(pdf);
}
