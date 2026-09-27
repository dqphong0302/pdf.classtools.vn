import { PDFDocument, degrees } from 'pdf-lib';

export interface PageRotation {
  pageIndex: number; // 0-based
  angle: number; // 0, 90, 180, 270
}

/**
 * Rotates all pages or specific pages in a PDF document by a given angle delta.
 */
export async function rotatePdfPages(
  sourceBytes: Uint8Array,
  rotations: Map<number, number> | number
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const count = pdf.getPageCount();

  for (let i = 0; i < count; i++) {
    const page = pdf.getPage(i);
    const currentAngle = page.getRotation().angle;
    let newAngle = currentAngle;

    if (typeof rotations === 'number') {
      newAngle = (currentAngle + rotations) % 360;
    } else if (rotations.has(i)) {
      const target = rotations.get(i)!;
      newAngle = target % 360;
    }

    if (newAngle < 0) newAngle += 360;
    page.setRotation(degrees(newAngle));
  }

  return await pdf.save();
}
