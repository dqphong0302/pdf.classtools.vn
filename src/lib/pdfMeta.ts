import type { PDFDocument } from 'pdf-lib';
import { openForOps } from './pdfOps';

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface PdfMetadataDraft {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

function toDate(value: Date | undefined): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

export async function readMetadata(bytes: Uint8Array): Promise<PdfMetadata> {
  const doc = await openForOps(bytes);
  return {
    title: doc.doc.getTitle() ?? '',
    author: doc.doc.getAuthor() ?? '',
    subject: doc.doc.getSubject() ?? '',
    keywords: doc.doc.getKeywords() ? doc.doc.getKeywords()!.split(/[,;\s]+/).filter(Boolean) : [],
    creator: doc.doc.getCreator() ?? '',
    producer: doc.doc.getProducer() ?? '',
    createdAt: toDate(doc.doc.getCreationDate()),
    modifiedAt: toDate(doc.doc.getModificationDate())
  };
}

export function parseKeywords(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function formatKeywords(keywords: string[]): string {
  return keywords.join(', ');
}

export async function writeMetadata(bytes: Uint8Array, draft: PdfMetadataDraft): Promise<Uint8Array> {
  const doc = await openForOps(bytes);
  applyDraft(doc.doc, draft);
  return doc.doc.save();
}

export async function clearMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await openForOps(bytes);
  doc.doc.setTitle('');
  doc.doc.setAuthor('');
  doc.doc.setSubject('');
  doc.doc.setKeywords([]);
  doc.doc.setCreator('');
  doc.doc.setProducer('ClassTools PDF');
  return doc.doc.save();
}

function applyDraft(doc: PDFDocument, draft: PdfMetadataDraft): void {
  if (draft.title.trim()) doc.setTitle(draft.title.trim());
  if (draft.author.trim()) doc.setAuthor(draft.author.trim());
  if (draft.subject.trim()) doc.setSubject(draft.subject.trim());
  const keywords = parseKeywords(draft.keywords);
  if (keywords.length) doc.setKeywords(keywords);
}

