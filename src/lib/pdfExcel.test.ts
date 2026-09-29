import { describe, expect, it, vi } from 'vitest';
import type { PdfTextItem } from './pdfPreview';

vi.mock('./pdfPreview', () => ({ openPdfView: vi.fn() }));
const { textItemsToRows } = await import('./pdfExcel');

const item = (str: string, x: number, y: number, size = 10): PdfTextItem => ({
  str,
  x,
  y,
  width: str.length * size * 0.5,
  size
});

describe('textItemsToRows', () => {
  it('rebuilds a table from positioned text', () => {
    const rows = textItemsToRows([
      item('Họ tên', 50, 700),
      item('Điểm', 250, 700),
      item('Mã', 350, 700),
      item('Nguyễn', 50, 685),
      item('An', 85, 685),
      item('8.5', 250, 685),
      item('0123', 350, 685),
      item('Lê Bình', 50, 670),
      item('10', 252, 670)
    ]);
    expect(rows).toEqual([
      ['Họ tên', 'Điểm', 'Mã'],
      ['Nguyễn An', 8.5, '0123'],
      ['Lê Bình', 10]
    ]);
  });

  it('merges items on the same baseline despite small jitter', () => {
    expect(textItemsToRows([item('A', 50, 700), item('B', 200, 701.5)])).toEqual([['A', 'B']]);
  });

  it('returns no rows for an empty page', () => {
    expect(textItemsToRows([])).toEqual([]);
  });
});
