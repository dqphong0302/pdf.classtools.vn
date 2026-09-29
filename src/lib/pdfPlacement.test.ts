import { PDFDocument, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { centeredOrigin, pageFrame } from './pdfPlacement';

async function pageWithRotation(angle: number) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 100]);
  page.setRotation(degrees(angle));
  return page;
}

describe('pageFrame', () => {
  it('maps the visual bottom-left corner onto the right PDF corner for each rotation', async () => {
    const expected: Record<number, { w: number; h: number; x: number; y: number }> = {
      0: { w: 200, h: 100, x: 0, y: 0 },
      90: { w: 100, h: 200, x: 200, y: 0 },
      180: { w: 200, h: 100, x: 200, y: 100 },
      270: { w: 100, h: 200, x: 0, y: 100 }
    };
    for (const [angle, want] of Object.entries(expected)) {
      const frame = pageFrame(await pageWithRotation(Number(angle)));
      expect([frame.width, frame.height]).toEqual([want.w, want.h]);
      expect(frame.toPdf(0, 0)).toEqual({ x: want.x, y: want.y });
    }
  });

  it('maps the visual top-left corner for a 90° page to the PDF origin', async () => {
    const frame = pageFrame(await pageWithRotation(90));
    expect(frame.toPdf(0, frame.height)).toEqual({ x: 0, y: 0 });
  });
});

describe('centeredOrigin', () => {
  it('is the plain half-offset without rotation', () => {
    expect(centeredOrigin(100, 50, 40, 10, 0)).toEqual({ x: 80, y: 45 });
  });

  it('keeps the box centre fixed when rotated 90°', () => {
    const origin = centeredOrigin(100, 50, 40, 10, 90);
    // Centre = origin + R(90°)·(20, 5) = origin + (-5, 20)
    expect(origin.x - 5).toBeCloseTo(100);
    expect(origin.y + 20).toBeCloseTo(50);
  });
});
