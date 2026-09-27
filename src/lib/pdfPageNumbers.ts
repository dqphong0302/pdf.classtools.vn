import { PDFDocument, rgb } from 'pdf-lib';
import { ensureEmbeddedFonts } from './pdfEdit';

export type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-right'
  | 'top-left';

export interface PageNumberOptions {
  position: PageNumberPosition;
  format: string; // e.g. '{n} / {total}', 'Trang {n} / {total}', 'Page {n} of {total}', '{n}'
  startFrom: number; // e.g. 1
  firstPageToNumber: number; // 1-based, e.g. 1 or 2 (to skip cover page)
  fontSize: number; // e.g. 10
  colorHex: string; // e.g. '#555555'
  marginPt: number; // distance from edge, e.g. 24
}

export async function addPageNumbers(
  sourceBytes: Uint8Array,
  options: PageNumberOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const fonts = await ensureEmbeddedFonts(pdf);
  const totalPages = pdf.getPageCount();

  const cleanHex = options.colorHex.replace('#', '').trim();
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255 || 0.3;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255 || 0.3;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255 || 0.3;
  const fontColor = rgb(r, g, b);

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    if (pageNum < options.firstPageToNumber) continue;

    const currentNumber = options.startFrom + (i - (options.firstPageToNumber - 1));
    const text = options.format
      .replace(/\{n\}/g, String(currentNumber))
      .replace(/\{total\}/g, String(totalPages - (options.firstPageToNumber - 1)));

    const page = pdf.getPage(i);
    const { width, height } = page.getSize();
    const textWidth = fonts.regular.widthOfTextAtSize(text, options.fontSize);

    let x = (width - textWidth) / 2;
    let y = options.marginPt;

    switch (options.position) {
      case 'bottom-left':
        x = options.marginPt;
        y = options.marginPt;
        break;
      case 'bottom-center':
        x = (width - textWidth) / 2;
        y = options.marginPt;
        break;
      case 'bottom-right':
        x = width - textWidth - options.marginPt;
        y = options.marginPt;
        break;
      case 'top-left':
        x = options.marginPt;
        y = height - options.marginPt - options.fontSize;
        break;
      case 'top-center':
        x = (width - textWidth) / 2;
        y = height - options.marginPt - options.fontSize;
        break;
      case 'top-right':
        x = width - textWidth - options.marginPt;
        y = height - options.marginPt - options.fontSize;
        break;
    }

    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font: fonts.regular,
      color: fontColor
    });
  }

  return await pdf.save();
}
