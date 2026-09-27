import { PDFDocument } from 'pdf-lib';
import { clampPct, placementFromPct } from './pdfEdit';

export interface SignaturePlacement {
  pageIndex: number;
  pngBytes: Uint8Array;
  xPct: number;
  yPct: number;
  widthPct: number;
}

export interface PlacedSignature {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Places a transparent PNG signature on one page. Height keeps the
 * intrinsic aspect ratio; width is a percentage of the page width.
 */
export async function placeSignature(pdf: PDFDocument, placement: SignaturePlacement): Promise<PlacedSignature> {
  const page = pdf.getPage(placement.pageIndex);
  const embedded = await pdf.embedPng(placement.pngBytes);
  const width = (clampPct(placement.widthPct) / 100) * page.getWidth();
  const scale = width / embedded.width;
  const height = embedded.height * scale;
  const { x, y } = placementFromPct(
    page.getWidth(),
    page.getHeight(),
    clampPct(placement.xPct),
    clampPct(placement.yPct),
    width,
    height
  );
  page.drawImage(embedded, { x, y, width, height });
  return { x, y, width, height };
}

export async function placeSignatures(pdf: PDFDocument, placements: SignaturePlacement[]): Promise<PlacedSignature[]> {
  const results: PlacedSignature[] = [];
  for (const placement of placements) {
    results.push(await placeSignature(pdf, placement));
  }
  return results;
}
