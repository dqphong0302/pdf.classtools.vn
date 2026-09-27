import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { createNup, NUP_SHEET } from './pdfNup';
import { getPdfPageCount } from './pdfOps';

let basePdf: Uint8Array;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 9; index += 1) {
    const page = doc.addPage([595, 842]);
    page.drawText(`P${index + 1}`, { x: 20, y: 400, size: 36, font });
  }
  basePdf = await doc.save();
});

describe('createNup', () => {
  it('packs 2 pages per sheet (2-up portrait: 1 col x 2 rows)', async () => {
    const result = await createNup(basePdf, { cols: 1, rows: 2, landscape: false });
    expect(await getPdfPageCount(result)).toBe(5);
  });

  it('packs 4 pages per sheet (4-up landscape: 2 cols x 2 rows)', async () => {
    const result = await createNup(basePdf, { cols: 2, rows: 2, landscape: true });
    expect(await getPdfPageCount(result)).toBe(3);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getWidth()).toBe(NUP_SHEET[1]);
  });

  it('clamps cells into a 1-4 range', async () => {
    const result = await createNup(basePdf, { cols: 99, rows: 0, landscape: false });
    expect(await getPdfPageCount(result)).toBe(3);
  });
});
