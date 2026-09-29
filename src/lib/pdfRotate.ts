import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Rotates pages by a clockwise delta on top of their existing /Rotate: either one
 * delta for every page, or a per-page map (0-based index → delta). Pages missing
 * from the map keep their rotation.
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
      newAngle = (currentAngle + rotations.get(i)!) % 360;
    }

    if (newAngle < 0) newAngle += 360;
    page.setRotation(degrees(newAngle));
  }

  return await pdf.save();
}
