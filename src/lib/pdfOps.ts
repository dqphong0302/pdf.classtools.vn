import { PDFDocument, degrees, type PDFPage } from 'pdf-lib';

export class EncryptedPdfError extends Error {
  constructor() {
    super('PDF_ENCRYPTED');
    this.name = 'EncryptedPdfError';
  }
}

export type RotationDegrees = 0 | 90 | 180 | 270;

export interface LoadedPdf {
  doc: PDFDocument;
  bytes: Uint8Array;
  pageCount: number;
}

async function loadDocument(bytes: Uint8Array): Promise<PDFDocument> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    throw new Error(`PDF_LOAD_FAILED:${error instanceof Error ? error.message : 'unknown'}`);
  }
  if (doc.isEncrypted) throw new EncryptedPdfError();
  return doc;
}

export async function openForOps(bytes: Uint8Array): Promise<LoadedPdf> {
  const doc = await loadDocument(bytes);
  return { doc, bytes, pageCount: doc.getPageCount() };
}

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  return (await openForOps(bytes)).pageCount;
}

function copyPages(source: PDFDocument, target: PDFDocument, indices: number[]): Promise<PDFPage[]> {
  return target.copyPages(source, indices);
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('NO_INPUT');
  const target = await PDFDocument.create();
  for (const file of files) {
    const source = await openForOps(file);
    const pages = await copyPages(source.doc, target, source.doc.getPageIndices());
    pages.forEach((page) => target.addPage(page));
  }
  target.setProducer('ClassTools PDF');
  target.setCreator('ClassTools PDF (classtools.vn)');
  return target.save();
}

export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  if (!indices.length) throw new Error('NO_PAGES');
  const source = await openForOps(bytes);
  const target = await PDFDocument.create();
  const pages = await copyPages(source.doc, target, indices);
  pages.forEach((page) => target.addPage(page));
  target.setProducer('ClassTools PDF');
  return target.save();
}

export async function removePages(bytes: Uint8Array, removeIndices: number[]): Promise<Uint8Array> {
  const doc = await openForOps(bytes);
  const removeSet = new Set(removeIndices);
  const keep = doc.doc.getPageIndices().filter((index) => !removeSet.has(index));
  if (!keep.length) throw new Error('WOULD_REMOVE_ALL');
  return extractPages(bytes, keep);
}

export async function reorderPages(bytes: Uint8Array, order: number[]): Promise<Uint8Array> {
  const doc = await openForOps(bytes);
  const total = doc.pageCount;
  if (order.length !== total || new Set(order).size !== total || order.some((value) => value < 0 || value >= total)) {
    throw new Error('BAD_ORDER');
  }
  return extractPages(bytes, order);
}

export async function rotatePages(bytes: Uint8Array, rotations: Map<number, RotationDegrees>): Promise<Uint8Array> {
  const doc = await openForOps(bytes);
  doc.doc.getPages().forEach((page, index) => {
    const extra = rotations.get(index);
    if (!extra) return;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + extra) % 360));
  });
  return doc.doc.save();
}

export async function splitEveryN(bytes: Uint8Array, size: number): Promise<{ name: string; bytes: Uint8Array }[]> {
  const doc = await openForOps(bytes);
  const safeSize = Math.max(1, Math.floor(size));
  const indices = doc.doc.getPageIndices();
  const chunks: number[][] = [];
  for (let start = 0; start < indices.length; start += safeSize) {
    chunks.push(indices.slice(start, start + safeSize));
  }
  const outputs: { name: string; bytes: Uint8Array }[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const part = await extractPages(bytes, chunks[index]);
    const from = chunks[index][0] + 1;
    const to = chunks[index][chunks[index].length - 1] + 1;
    outputs.push({ name: from === to ? `part-${from}.pdf` : `part-${from}-${to}.pdf`, bytes: part });
  }
  return outputs;
}
