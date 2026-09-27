import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { placeSignature } from './pdfSign';

// 1x1 fully transparent PNG.
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (char) => char.charCodeAt(0)
);

describe('placeSignature', () => {
  it('draws a PNG keeping the intrinsic aspect ratio', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);

    const placement = await placeSignature(pdf, {
      pageIndex: 0,
      pngBytes: TINY_PNG,
      xPct: 10,
      yPct: 20,
      widthPct: 50
    });

    // 1x1 PNG at 50% width of a 595pt page.
    expect(placement.width).toBeCloseTo(297.5);
    expect(placement.x).toBeCloseTo(59.5);
    expect(placement.y).toBeCloseTo(842 - 168.4 - placement.height);
  });

  it('clamps out-of-range percentages', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const placement = await placeSignature(pdf, {
      pageIndex: 0,
      pngBytes: TINY_PNG,
      xPct: 150,
      yPct: -20,
      widthPct: 200
    });
    expect(placement.x).toBeLessThanOrEqual(595);
    expect(placement.y).toBeGreaterThanOrEqual(-placement.height);
  });
});
