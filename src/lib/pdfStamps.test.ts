import { PDFDocument, PDFPage, StandardFonts, degrees } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addPageNumbers, pageNumberLabel } from './pdfPageNumbers';
import { addWatermark } from './pdfWatermark';
import { rotatePdfPages } from './pdfRotate';
import { flattenPdf } from './pdfFlatten';

// Roboto is fetched from a Vite asset URL in the app; Helvetica is enough for layout tests.
vi.mock('./pdfEdit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pdfEdit')>()),
  ensureEmbeddedFonts: async (pdf: PDFDocument) => {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    return { regular: font, bold: font };
  }
}));

async function pdfWithPages(rotations: number[]) {
  const doc = await PDFDocument.create();
  for (const angle of rotations) doc.addPage([200, 100]).setRotation(degrees(angle));
  return doc.save();
}

afterEach(() => vi.restoreAllMocks());

describe('addPageNumbers', () => {
  it('keeps pure black and places numbers on the visual bottom of rotated pages', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    await addPageNumbers(await pdfWithPages([0, 90]), {
      position: 'bottom-left',
      format: '{n}/{total}',
      startFrom: 1,
      firstPageToNumber: 1,
      fontSize: 10,
      colorHex: '#000000',
      marginPt: 20
    });

    expect(drawText).toHaveBeenCalledTimes(2);
    const [, first] = drawText.mock.calls[0];
    expect(first?.color).toMatchObject({ red: 0, green: 0, blue: 0 });
    expect(first).toMatchObject({ x: 20, y: 20 });
    expect(first?.rotate).toMatchObject({ angle: 0 });

    // 90° page: visual (20, 20) → PDF (200 - 20, 20), text turned with the page.
    const [text, second] = drawText.mock.calls[1];
    expect(text).toBe('2/2');
    expect(second).toMatchObject({ x: 180, y: 20 });
    expect(second?.rotate).toMatchObject({ angle: 90 });
  });

  it('skips the cover page and renumbers the rest', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    await addPageNumbers(await pdfWithPages([0, 0, 0]), {
      position: 'bottom-center',
      format: '{n}/{total}',
      startFrom: 1,
      firstPageToNumber: 2,
      fontSize: 10,
      colorHex: '#555555',
      marginPt: 20
    });
    expect(drawText.mock.calls.map(([text]) => text)).toEqual(['1/2', '2/2']);
  });
});

describe('addWatermark', () => {
  it('centres a single rotated stamp on the page', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    await addWatermark(await pdfWithPages([0]), {
      type: 'text',
      text: 'MAT',
      angle: 45,
      opacity: 0.3,
      fontSize: 40,
      colorHex: '#000000',
      tiled: false
    });
    expect(drawText).toHaveBeenCalledOnce();
    const options = drawText.mock.calls[0][1]!;
    expect(options.color).toMatchObject({ red: 0, green: 0, blue: 0 });
    const font = options.font!;
    const width = font.widthOfTextAtSize('MAT', 40);
    const height = 40 * 0.7;
    const rad = Math.PI / 4;
    // Rotating (width/2, height/2) about the origin must land on the page centre.
    expect(options.x! + Math.cos(rad) * width / 2 - Math.sin(rad) * height / 2).toBeCloseTo(100);
    expect(options.y! + Math.sin(rad) * width / 2 + Math.cos(rad) * height / 2).toBeCloseTo(50);
  });

  it('tiles across the whole page', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    await addWatermark(await pdfWithPages([0]), {
      type: 'text',
      text: 'A',
      angle: 0,
      opacity: 0.3,
      fontSize: 10,
      colorHex: '#888888',
      tiled: true
    });
    expect(drawText.mock.calls.length).toBeGreaterThan(4);
  });
});

describe('rotatePdfPages', () => {
  it('adds a delta to every page or to specific pages, keeping existing rotation', async () => {
    const source = await pdfWithPages([0, 90]);
    const all = await PDFDocument.load(await rotatePdfPages(source, 90));
    expect(all.getPages().map((page) => page.getRotation().angle)).toEqual([90, 180]);

    const some = await PDFDocument.load(await rotatePdfPages(source, new Map([[0, 0], [1, 270]])));
    expect(some.getPages().map((page) => page.getRotation().angle)).toEqual([0, 0]);

    const untouched = await PDFDocument.load(await rotatePdfPages(source, new Map([[0, 180]])));
    expect(untouched.getPages().map((page) => page.getRotation().angle)).toEqual([180, 90]);
  });
});

describe('flattenPdf', () => {
  it('removes interactive form fields', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const field = doc.getForm().createTextField('name');
    field.setText('Phong');
    field.addToPage(page, { x: 10, y: 10, width: 100, height: 20 });
    const flattened = await PDFDocument.load(await flattenPdf(await doc.save()));
    expect(flattened.getForm().getFields()).toHaveLength(0);
  });
});

describe('pageNumberLabel', () => {
  const base = { position: 'bottom-center' as const, startFrom: 1, firstPageToNumber: 1, fontSize: 10, colorHex: '#000', marginPt: 20 };
  it('expands {n}/{total} and the {page}/{pages} aliases, falling back to the number', () => {
    expect(pageNumberLabel(1, 5, { ...base, format: '{n} / {total}' })).toBe('2 / 5');
    expect(pageNumberLabel(2, 5, { ...base, format: 'Trang {page}' })).toBe('Trang 3');
    expect(pageNumberLabel(0, 9, { ...base, format: 'Page {n} of {pages}' })).toBe('Page 1 of 9');
    expect(pageNumberLabel(3, 5, { ...base, format: '' })).toBe('4');
  });
});
