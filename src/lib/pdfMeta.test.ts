import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { clearMetadata, formatKeywords, parseKeywords, readMetadata, writeMetadata, type PdfMetadataDraft } from './pdfMeta';

let basePdf: Uint8Array;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 400]);
  page.drawText('Meta', { x: 20, y: 200, size: 24, font });
  doc.setTitle('Giáo án tuần 1');
  doc.setAuthor('Phong Dang');
  doc.setSubject('Toán học');
  doc.setKeywords(['toan', 'lý', 'hóa']);
  basePdf = await doc.save();
});

describe('readMetadata', () => {
  it('reads all standard fields', async () => {
    const meta = await readMetadata(basePdf);
    expect(meta.title).toBe('Giáo án tuần 1');
    expect(meta.author).toBe('Phong Dang');
    expect(meta.subject).toBe('Toán học');
    expect(meta.keywords).toEqual(['toan', 'lý', 'hóa']);
  });

  it('returns empty values for anonymous documents', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const meta = await readMetadata(await doc.save());
    expect(meta.title).toBe('');
    expect(meta.createdAt).toBeTypeOf('string');
  });
});

describe('writeMetadata', () => {
  it('updates the provided fields only', async () => {
    const draft: PdfMetadataDraft = { title: 'Tiêu đề mới', author: '', subject: '', keywords: '' };
    const result = await writeMetadata(basePdf, draft);
    const meta = await readMetadata(result);
    expect(meta.title).toBe('Tiêu đề mới');
    expect(meta.author).toBe('Phong Dang');
  });

  it('writes keywords from comma separated input', async () => {
    const result = await writeMetadata(basePdf, { title: '', author: '', subject: '', keywords: 'a, b; c\nd' });
    const meta = await readMetadata(result);
    expect(meta.keywords).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('clearMetadata', () => {
  it('strips title, author, subject and keywords', async () => {
    const result = await clearMetadata(basePdf);
    const meta = await readMetadata(result);
    expect(meta.title).toBe('');
    expect(meta.author).toBe('');
    expect(meta.subject).toBe('');
    expect(meta.keywords).toEqual([]);
  });
});

describe('keyword helpers', () => {
  it('parses and formats keyword lists', () => {
    expect(parseKeywords(' a, b;;c \n d ')).toEqual(['a', 'b', 'c', 'd']);
    expect(parseKeywords('')).toEqual([]);
    expect(formatKeywords(['x', 'y'])).toBe('x, y');
  });
});
