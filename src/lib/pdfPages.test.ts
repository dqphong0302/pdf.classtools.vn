import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyCrop, duplicatePages, insertBlankPage, mmToPt, reversePages } from './pdfPages';
import { getPdfPageCount } from './pdfOps';

let basePdf: Uint8Array;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 4; index += 1) {
    const page = doc.addPage([300, 400]);
    page.drawText(`P${index + 1}`, { x: 20, y: 200, size: 24, font });
  }
  basePdf = await doc.save();
});

describe('insertBlankPage', () => {
  it('inserts a blank page in the middle matching previous page size', async () => {
    const result = await insertBlankPage(basePdf, 2);
    expect(await getPdfPageCount(result)).toBe(5);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(2).getWidth()).toBe(300);
  });

  it('appends at the end when index equals page count', async () => {
    const result = await insertBlankPage(basePdf, 4, [200, 300]);
    expect(await getPdfPageCount(result)).toBe(5);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(4).getWidth()).toBe(200);
  });

  it('clamps out-of-range indexes', async () => {
    const result = await insertBlankPage(basePdf, 99);
    expect(await getPdfPageCount(result)).toBe(5);
  });
});

describe('duplicatePages', () => {
  it('duplicates selected pages right after each original', async () => {
    const result = await duplicatePages(basePdf, [1, 3]);
    expect(await getPdfPageCount(result)).toBe(6);
  });

  it('deduplicates and clamps indices', async () => {
    const result = await duplicatePages(basePdf, [2, 2, 99, -1]);
    expect(await getPdfPageCount(result)).toBe(5);
  });

  it('rejects empty selection', async () => {
    await expect(duplicatePages(basePdf, [99])).rejects.toThrow('NO_PAGES');
  });
});

describe('reversePages', () => {
  it('reverses the order', async () => {
    const result = await reversePages(basePdf);
    expect(await getPdfPageCount(result)).toBe(4);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getWidth()).toBe(300);
  });
});

describe('applyCrop', () => {
  it('sets a crop box smaller than the media box', async () => {
    const { bytes, pages, skippedPages } = await applyCrop(basePdf, { top: 10, right: 10, bottom: 10, left: 10 });
    expect(pages).toBe(4);
    expect(skippedPages).toBe(0);
    const doc = await PDFDocument.load(bytes);
    const crop = doc.getPage(0).getCropBox();
    expect(crop.width).toBeCloseTo(300 - 2 * mmToPt(10));
    expect(crop.height).toBeCloseTo(400 - 2 * mmToPt(10));
  });

  it('skips pages that would become too small', async () => {
    const { skippedPages } = await applyCrop(basePdf, { top: 150, right: 150, bottom: 150, left: 150 });
    expect(skippedPages).toBe(4);
  });
});

describe('mmToPt', () => {
  it('converts millimetres to points', () => {
    expect(mmToPt(10)).toBeCloseTo(28.35, 1);
    expect(mmToPt(-5)).toBe(0);
  });
});
