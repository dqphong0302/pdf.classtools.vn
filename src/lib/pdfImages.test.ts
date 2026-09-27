import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { imagesToPdf, planImagePlacement, parseOrientation } from './pdfImages';
import { getPdfPageCount } from './pdfOps';

// 2x2 red PNG
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8z8DwnwEAAMIByR/6d1AAAAAASUVORK5CYII='),
  (char) => char.charCodeAt(0)
);

describe('planImagePlacement', () => {
  it('scales the image up to fill the available box, keeping aspect ratio', () => {
    const plan = planImagePlacement({ width: 400, height: 200 }, [595, 842], 20);
    expect(plan.drawWidth).toBeCloseTo(555);
    expect(plan.drawHeight).toBeCloseTo(277.5);
    expect(plan.x).toBeCloseTo(20);
    expect(plan.y).toBeCloseTo((842 - 277.5) / 2);
  });

  it('scales down large images to fit', () => {
    const plan = planImagePlacement({ width: 2000, height: 1000 }, [595, 842], 0);
    expect(plan.drawWidth).toBeCloseTo(595);
    expect(plan.drawHeight).toBeCloseTo(297.5);
  });

  it('never exceeds the inner box', () => {
    const plan = planImagePlacement({ width: 100, height: 5000 }, [595, 842], 10);
    expect(plan.drawHeight).toBeLessThanOrEqual(842 - 20);
  });
});

describe('parseOrientation', () => {
  it('detects portrait and landscape by pixel size', () => {
    expect(parseOrientation(300, 400)).toBe('portrait');
    expect(parseOrientation(400, 300)).toBe('landscape');
  });
});

describe('imagesToPdf', () => {
  it('creates one page per image with auto page size', async () => {
    const result = await imagesToPdf([TINY_PNG, TINY_PNG], { pageSize: 'auto', orientation: 'auto', marginMm: 0 });
    expect(await getPdfPageCount(result)).toBe(2);
    const doc = await PDFDocument.load(result);
    // 2x2 px * 0.75 = 1.5pt page
    expect(doc.getPage(0).getWidth()).toBeCloseTo(1.5);
  });

  it('uses fixed page sizes with margins in a4 mode', async () => {
    const result = await imagesToPdf([TINY_PNG], { pageSize: 'a4', orientation: 'portrait', marginMm: 20 });
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getWidth()).toBe(595);
    expect(doc.getPage(0).getHeight()).toBe(842);
  });

  it('rejects empty input', async () => {
    await expect(imagesToPdf([], { pageSize: 'auto', orientation: 'auto', marginMm: 0 })).rejects.toThrow('NO_IMAGES');
  });
});
