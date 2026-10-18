import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Runs on the same line closer than this (in points), or overlapping, are one word split by kerning. */
const SAME_WORD_GAP = 0.5;

/**
 * The text of every page of a PDF in drawing order, one string per page with runs of whitespace
 * collapsed. Separate text runs are joined with a space unless they touch on the same line. For
 * tests.
 */
export async function pdfText(pdf: Buffer): Promise<string[]> {
  const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: false });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      let text = '';
      let prev: { end: number; y: number } | null = null;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const [, , , , x, y] = item.transform as number[];
        const touches = prev && prev.y === y && x! - prev.end < SAME_WORD_GAP;
        text += (touches ? '' : ' ') + item.str;
        prev = { end: x! + item.width, y: y! };
      }
      pages.push(text.replace(/\s+/g, ' ').trim());
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
