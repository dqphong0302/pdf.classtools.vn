import { PDFDocument, rgb } from 'pdf-lib';

export interface RedactBox {
  pageIndex: number; // 0-based
  x: number; // pt
  y: number; // pt
  width: number;
  height: number;
}

export async function redactPdf(
  sourceBytes: Uint8Array,
  boxes: RedactBox[],
  color: 'black' | 'white' = 'black'
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const fillColor = color === 'black' ? rgb(0, 0, 0) : rgb(1, 1, 1);

  for (const box of boxes) {
    if (box.pageIndex < 0 || box.pageIndex >= pdf.getPageCount()) continue;
    const page = pdf.getPage(box.pageIndex);
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      color: fillColor,
      opacity: 1
    });
  }

  // Also flatten form fields to prevent hidden field inspection
  try {
    const form = pdf.getForm();
    form.flatten();
  } catch {
    // PDF might not have interactive form
  }

  return await pdf.save();
}
