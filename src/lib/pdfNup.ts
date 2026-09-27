import { PDFDocument } from 'pdf-lib';
import { openForOps } from './pdfOps';

export interface NupOptions {
  cols: number;
  rows: number;
  landscape: boolean;
}

export const NUP_SHEET: [number, number] = [595, 842];

function clampCells(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

/** Lays pages out on sheets: `cols` x `rows` source pages per A4 sheet, centered per cell. */
export async function createNup(bytes: Uint8Array, options: NupOptions): Promise<Uint8Array> {
  const cols = clampCells(options.cols, 4);
  const rows = clampCells(options.rows, 4);
  const source = await openForOps(bytes);
  const output = await PDFDocument.create();

  const sheet: [number, number] = options.landscape ? [NUP_SHEET[1], NUP_SHEET[0]] : NUP_SHEET;
  const embedded = await output.embedPages(source.doc.getPages());
  const perSheet = cols * rows;
  const cellWidth = sheet[0] / cols;
  const cellHeight = sheet[1] / rows;

  for (let start = 0; start < embedded.length; start += perSheet) {
    const group = embedded.slice(start, start + perSheet);
    const page = output.addPage(sheet);
    group.forEach((embeddedPage, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const scale = Math.min(cellWidth / embeddedPage.width, cellHeight / embeddedPage.height);
      const width = embeddedPage.width * scale;
      const height = embeddedPage.height * scale;
      const x = col * cellWidth + (cellWidth - width) / 2;
      const y = sheet[1] - (row + 1) * cellHeight + (cellHeight - height) / 2;
      page.drawPage(embeddedPage, { x, y, width, height });
    });
  }

  output.setProducer('ClassTools PDF');
  return output.save();
}
