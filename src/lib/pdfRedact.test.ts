import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { redactPdf, type PageRasterizer } from './pdfRedact';

// 1×1 PNG
const PIXEL = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0)
);

async function twoPagePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([300, 400]).drawText('SECRET 0123456789', { x: 20, y: 200, size: 18, font });
  const second = doc.addPage([300, 400]);
  second.drawText('Public page', { x: 20, y: 200, size: 18, font: await doc.embedFont(StandardFonts.Courier) });
  return doc.save();
}

function fontObjectCount(doc: PDFDocument) {
  return doc.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of('Type')) === PDFName.of('Font')).length;
}

describe('redactPdf', () => {
  it('replaces redacted pages with a flat image and drops their original content', async () => {
    const rasterize = vi.fn<PageRasterizer>().mockResolvedValue({ bytes: PIXEL, format: 'png', width: 300, height: 400 });
    const output = await redactPdf(
      await twoPagePdf(),
      [{ pageIndex: 0, x: 10, y: 190, width: 200, height: 30 }],
      'black',
      rasterize
    );

    expect(rasterize).toHaveBeenCalledOnce();
    expect(rasterize.mock.calls[0][0]).toBe(0);

    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(2);
    const firstResources = doc.getPage(0).node.Resources();
    const fonts = firstResources?.lookupMaybe(PDFName.of('Font'), PDFDict);
    expect(fonts?.keys() ?? []).toHaveLength(0);
    expect(firstResources?.get(PDFName.of('XObject'))).toBeDefined();
    // Only the untouched page's Courier font survives — Helvetica from the redacted page is gone.
    expect(fontObjectCount(doc)).toBe(1);
  });

  it('ignores boxes outside the document', async () => {
    const rasterize = vi.fn<PageRasterizer>();
    const output = await redactPdf(await twoPagePdf(), [{ pageIndex: 9, x: 0, y: 0, width: 10, height: 10 }], 'black', rasterize);
    expect(rasterize).not.toHaveBeenCalled();
    expect((await PDFDocument.load(output)).getPageCount()).toBe(2);
  });
});
