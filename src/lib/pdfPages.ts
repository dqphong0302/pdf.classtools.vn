import { PDFDocument } from 'pdf-lib';
import { openForOps } from './pdfOps';

const MM_TO_PT = 2.834645669;

export function mmToPt(mm: number): number {
  if (!Number.isFinite(mm)) return 0;
  return Math.max(0, mm) * MM_TO_PT;
}

/** Inserts a blank page at `atIndex` (0-based; `pageCount` = append at end). */
export async function insertBlankPage(
  bytes: Uint8Array,
  atIndex: number,
  size?: [number, number]
): Promise<Uint8Array> {
  const doc = await openForOps(bytes);
  const page = doc.doc.getPageCount() > 0
    ? doc.doc.getPage(Math.min(Math.max(0, atIndex), doc.pageCount - 1))
    : null;
  const pageSize = size ?? (page ? [page.getWidth(), page.getHeight()] : [595, 842]);

  if (atIndex >= doc.pageCount) {
    doc.doc.addPage(pageSize);
    return doc.doc.save();
  }

  doc.doc.insertPage(Math.max(0, atIndex), pageSize);
  return doc.doc.save();
}

/** Duplicates the selected pages right after each original (keeps order). */
export async function duplicatePages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const doc = await openForOps(bytes);
  const selected = [...new Set(indices)].filter((index) => index >= 0 && index < doc.pageCount).sort((a, b) => a - b);
  if (!selected.length) throw new Error('NO_PAGES');

  // Build the new order: original pages with each selected page repeated after itself.
  const order: number[] = [];
  doc.doc.getPageIndices().forEach((index) => {
    order.push(index);
    if (selected.includes(index)) order.push(index);
  });
  return extractReorder(bytes, order);
}

/** Reverses the page order. */
export async function reversePages(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await openForOps(bytes);
  const order = doc.doc.getPageIndices().reverse();
  return extractReorder(bytes, order);
}

async function extractReorder(bytes: Uint8Array, order: number[]): Promise<Uint8Array> {
  const source = await openForOps(bytes);
  const target = await PDFDocument.create();
  const pages = await target.copyPages(source.doc, order);
  pages.forEach((page) => target.addPage(page));
  target.setProducer('ClassTools PDF');
  return target.save();
}

export interface CropMarginsMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CropResult {
  pages: number;
  skippedPages: number;
}

/** Crops visible margins on every page via CropBox. Content outside stays in the file. */
export async function applyCrop(bytes: Uint8Array, margins: CropMarginsMm): Promise<CropResult & { bytes: Uint8Array }> {
  const doc = await openForOps(bytes);
  const top = mmToPt(margins.top);
  const right = mmToPt(margins.right);
  const bottom = mmToPt(margins.bottom);
  const left = mmToPt(margins.left);
  let skippedPages = 0;

  doc.doc.getPages().forEach((page) => {
    const width = page.getWidth();
    const height = page.getHeight();
    const cropWidth = width - left - right;
    const cropHeight = height - top - bottom;

    // Keep at least a 36pt (0.5 inch) visible area; skip pages that are already too small.
    if (cropWidth < 36 || cropHeight < 36) {
      skippedPages += 1;
      return;
    }
    page.setCropBox(left, bottom, cropWidth, cropHeight);
  });

  const output = await doc.doc.save();
  return { bytes: output, pages: doc.pageCount, skippedPages };
}
