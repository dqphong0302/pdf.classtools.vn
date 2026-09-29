import { PDFDocument } from 'pdf-lib';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { imagesToPdf, planImagePlacement, parseOrientation } from './pdfImages';
import { getPdfPageCount } from './pdfOps';

// 2x2 red PNG
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8z8DwnwEAAMIByR/6d1AAAAAASUVORK5CYII='),
  (char) => char.charCodeAt(0)
);

/** Builds a solid grey PNG of the given size (8-bit greyscale). */
function makePng(width: number, height: number): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 0; // greyscale
  const raw = new Uint8Array(height * (width + 1)).fill(128);
  for (let y = 0; y < height; y += 1) raw[y * (width + 1)] = 0; // filter byte
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array())
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

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

  it('keeps the image shape with auto page size, and turns the page for a forced orientation', async () => {
    const wide = makePng(400, 200);
    const size = async (orientation: 'auto' | 'portrait' | 'landscape') => {
      const doc = await PDFDocument.load(await imagesToPdf([wide], { pageSize: 'auto', orientation, marginMm: 0 }));
      const { width, height } = doc.getPage(0).getSize();
      return width > height ? 'landscape' : 'portrait';
    };
    expect(await size('auto')).toBe('landscape');
    expect(await size('landscape')).toBe('landscape');
    expect(await size('portrait')).toBe('portrait');
  });
});
