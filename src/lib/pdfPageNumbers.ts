import { PDFDocument, degrees, type PDFFont } from 'pdf-lib';
import { ensureEmbeddedFonts, hexToPdfRgb } from './pdfEdit';
import { pageFrame } from './pdfPlacement';

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

/** Label for page `index` (0-based), or null when the page is not numbered. */
export function pageNumberLabel(index: number, totalPages: number, options: PageNumberOptions): string | null {
  const first = Math.max(1, options.firstPageToNumber);
  if (index + 1 < first) return null;
  const current = String(options.startFrom + index - (first - 1));
  const total = String(totalPages - (first - 1));
  return (
    options.format
      .replace(/\{(n|page)\}/gi, current)
      .replace(/\{(total|pages)\}/gi, total)
      .trim() || current
  );
}

/** Baseline origin (visual coordinates, bottom-left origin) of the label on a page. */
export function pageNumberOrigin(
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  options: Pick<PageNumberOptions, 'position' | 'marginPt' | 'fontSize'>
): { x: number; y: number } {
  const [vertical, horizontal] = options.position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  const x =
    horizontal === 'left'
      ? options.marginPt
      : horizontal === 'right'
        ? pageWidth - textWidth - options.marginPt
        : (pageWidth - textWidth) / 2;
  const y = vertical === 'top' ? pageHeight - options.marginPt - options.fontSize : options.marginPt;
  return { x, y };
}

/** Draws page numbers on every numbered page of an open document. */
export function stampPageNumbers(pdf: PDFDocument, font: PDFFont, options: PageNumberOptions): void {
  const totalPages = pdf.getPageCount();
  const fontColor = hexToPdfRgb(options.colorHex);

  pdf.getPages().forEach((page, index) => {
    const text = pageNumberLabel(index, totalPages, options);
    if (!text) return;
    const frame = pageFrame(page);
    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    const origin = pageNumberOrigin(frame.width, frame.height, textWidth, options);
    const at = frame.toPdf(origin.x, origin.y);
    page.drawText(text, {
      x: at.x,
      y: at.y,
      rotate: degrees(frame.rotation),
      size: options.fontSize,
      font,
      color: fontColor
    });
  });
}

export async function addPageNumbers(sourceBytes: Uint8Array, options: PageNumberOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const fonts = await ensureEmbeddedFonts(pdf);
  stampPageNumbers(pdf, fonts.regular, options);
  return await pdf.save();
}
