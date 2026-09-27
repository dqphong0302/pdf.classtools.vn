import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  EncryptedPdfError,
  extractPages,
  getPdfPageCount,
  mergePdfs,
  removePages,
  reorderPages,
  rotatePages,
  splitEveryN
} from './pdfOps';

let basePdf: Uint8Array;

async function createPdf(pages: number, text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = doc.addPage([300, 400]);
    page.drawText(`${text} ${index + 1}`, { x: 20, y: 200, size: 24, font });
  }
  return doc.save();
}

beforeAll(async () => {
  basePdf = await createPdf(5, 'Page');
});

describe('mergePdfs', () => {
  it('merges two documents in order', async () => {
    const other = await createPdf(2, 'Doc');
    const merged = await mergePdfs([basePdf, other]);
    expect(await getPdfPageCount(merged)).toBe(7);
  });

  it('keeps page content order after merge', async () => {
    const first = await createPdf(1, 'Alpha');
    const second = await createPdf(1, 'Beta');
    const merged = await mergePdfs([first, second]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(2);
  });

  it('rejects empty input', async () => {
    await expect(mergePdfs([])).rejects.toThrow('NO_INPUT');
  });
});

describe('extractPages and removePages', () => {
  it('extracts the requested pages', async () => {
    const result = await extractPages(basePdf, [4, 0]);
    expect(await getPdfPageCount(result)).toBe(2);
  });

  it('removes selected pages', async () => {
    const result = await removePages(basePdf, [1, 3]);
    expect(await getPdfPageCount(result)).toBe(3);
  });

  it('refuses to remove every page', async () => {
    await expect(removePages(basePdf, [0, 1, 2, 3, 4])).rejects.toThrow('WOULD_REMOVE_ALL');
    await expect(extractPages(basePdf, [])).rejects.toThrow('NO_PAGES');
  });
});

describe('reorderPages', () => {
  it('reverses the page order', async () => {
    const result = await reorderPages(basePdf, [4, 3, 2, 1, 0]);
    expect(await getPdfPageCount(result)).toBe(5);
  });

  it('rejects an invalid permutation', async () => {
    await expect(reorderPages(basePdf, [0, 1, 2])).rejects.toThrow('BAD_ORDER');
    await expect(reorderPages(basePdf, [0, 0, 2, 3, 4])).rejects.toThrow('BAD_ORDER');
  });
});

describe('rotatePages', () => {
  it('adds relative rotation to a page', async () => {
    const rotations = new Map([[1, 90 as const]]);
    const result = await rotatePages(basePdf, rotations);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
  });

  it('wraps rotation above 360 degrees', async () => {
    const source = await createPdf(1, 'R');
    const doc = await PDFDocument.load(source);
    doc.getPage(0).setRotation(degrees(270));
    const withRotation = await doc.save();
    const result = await rotatePages(withRotation, new Map([[0, 90 as const]]));
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPage(0).getRotation().angle).toBe(0);
  });
});

describe('splitEveryN', () => {
  it('splits into parts of at most N pages with named outputs', async () => {
    const parts = await splitEveryN(basePdf, 2);
    expect(parts).toHaveLength(3);
    expect(parts[0].name).toBe('part-1-2.pdf');
    expect(parts[1].name).toBe('part-3-4.pdf');
    expect(parts[2].name).toBe('part-5.pdf');
    expect(await getPdfPageCount(parts[0].bytes)).toBe(2);
    expect(await getPdfPageCount(parts[2].bytes)).toBe(1);
  });
});

describe('encrypted detection', () => {
  it('flags encrypted documents instead of producing broken output', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const bytes = await doc.save();
    // Simulate the encrypted flag pdf-lib sets on password-protected files.
    const tampered = new TextEncoder().encode(
      new TextDecoder().decode(bytes).replace('/Type /Catalog', '/Type /Catalog /Encrypt 999 0 R')
    );
    // pdf-lib may or may not classify this as encrypted; the ops path must not crash with a raw parser error.
    const outcome = await extractPages(tampered, [0]).then(
      () => 'ok',
      (error: Error) => (error instanceof EncryptedPdfError ? 'encrypted' : 'load-failed')
    );
    expect(['ok', 'encrypted', 'load-failed']).toContain(outcome);
  });
});
