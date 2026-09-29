import * as XLSX from 'xlsx';
import { PDFDocument, rgb } from 'pdf-lib';
import { ensureEmbeddedFonts } from './pdfEdit';
import { openPdfView, type PdfTextItem } from './pdfPreview';

export interface ExcelSheetData {
  name: string;
  rows: (string | number | boolean | null)[][];
}

export function parseExcelWorkbook(fileBytes: Uint8Array): ExcelSheetData[] {
  const wb = XLSX.read(fileBytes, { type: 'array' });
  const sheets: ExcelSheetData[] = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1 });
    sheets.push({ name, rows });
  }

  return sheets;
}

/**
 * Converts spreadsheet rows into a paginated PDF document with table borders and headers.
 */
export async function excelToPdf(
  sheets: ExcelSheetData[],
  selectedSheetIndex = 0
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = await ensureEmbeddedFonts(pdf);

  const targetSheet = sheets[selectedSheetIndex] || sheets[0];
  const rows = targetSheet ? targetSheet.rows.filter((r) => r && r.length > 0) : [];

  const pageWidth = 842; // A4 Landscape (pt)
  const pageHeight = 595;
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const rowHeight = 22;
  const fontSize = 9;

  // Determine max columns
  let maxCols = 1;
  for (const row of rows) {
    if (row.length > maxCols) maxCols = row.length;
  }
  maxCols = Math.min(maxCols, 12); // cap at 12 columns for readability

  const colWidth = usableWidth / maxCols;
  const rowsPerPage = Math.floor((pageHeight - margin * 2 - 40) / rowHeight);

  for (let rIdx = 0; rIdx < rows.length; rIdx += rowsPerPage) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    const slice = rows.slice(rIdx, rIdx + rowsPerPage);

    // Draw Title / Sheet Name
    page.drawText(`${targetSheet.name} (Trang ${Math.floor(rIdx / rowsPerPage) + 1})`, {
      x: margin,
      y: pageHeight - margin - 14,
      size: 12,
      font: fonts.bold,
      color: rgb(0.1, 0.2, 0.4)
    });

    let currentY = pageHeight - margin - 35;

    for (let i = 0; i < slice.length; i++) {
      const row = slice[i];
      const isHeader = rIdx === 0 && i === 0;

      // Draw row background for header or zebra striping
      if (isHeader) {
        page.drawRectangle({
          x: margin,
          y: currentY - rowHeight + 4,
          width: usableWidth,
          height: rowHeight,
          color: rgb(0.9, 0.94, 1.0)
        });
      } else if (i % 2 === 1) {
        page.drawRectangle({
          x: margin,
          y: currentY - rowHeight + 4,
          width: usableWidth,
          height: rowHeight,
          color: rgb(0.97, 0.98, 0.99)
        });
      }

      // Draw cell text
      for (let c = 0; c < maxCols; c++) {
        const val = row[c] != null ? String(row[c]).trim() : '';
        const font = isHeader ? fonts.bold : fonts.regular;
        const textColor = isHeader ? rgb(0.1, 0.2, 0.4) : rgb(0.15, 0.15, 0.15);

        // Truncate if too long
        let displayVal = val;
        while (displayVal.length > 0 && font.widthOfTextAtSize(displayVal, fontSize) > colWidth - 8) {
          displayVal = displayVal.slice(0, -1);
        }
        if (displayVal.length < val.length) displayVal += '…';

        page.drawText(displayVal, {
          x: margin + c * colWidth + 4,
          y: currentY - fontSize,
          size: fontSize,
          font,
          color: textColor
        });
      }

      // Draw horizontal line
      page.drawLine({
        start: { x: margin, y: currentY - rowHeight + 4 },
        end: { x: margin + usableWidth, y: currentY - rowHeight + 4 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.88)
      });

      currentY -= rowHeight;
    }

    // Outer border
    page.drawRectangle({
      x: margin,
      y: currentY + 4,
      width: usableWidth,
      height: slice.length * rowHeight,
      borderWidth: 0.8,
      borderColor: rgb(0.7, 0.75, 0.8),
      opacity: 0
    });
  }

  return await pdf.save();
}

type Cell = { text: string; x: number; end: number };

function toCellValue(text: string): string | number {
  const trimmed = text.trim();
  // Keep leading-zero codes (phone numbers, IDs) as text.
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(trimmed) && trimmed.length <= 15) return Number(trimmed);
  return trimmed;
}

/**
 * Rebuilds table rows from positioned text: items are grouped into lines by
 * baseline, glued into cells when the horizontal gap is small, then cells are
 * snapped to column anchors shared by the whole page.
 */
export function textItemsToRows(items: PdfTextItem[]): (string | number)[][] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PdfTextItem[][] = [];
  for (const item of sorted) {
    const line = lines[lines.length - 1];
    const tolerance = Math.max(2, item.size * 0.45);
    if (line && Math.abs(line[0].y - item.y) <= tolerance) line.push(item);
    else lines.push([item]);
  }

  const cellLines: Cell[][] = lines.map((line) => {
    const cells: Cell[] = [];
    for (const item of [...line].sort((a, b) => a.x - b.x)) {
      const last = cells[cells.length - 1];
      const gap = last ? item.x - last.end : Infinity;
      if (last && gap < item.size * 1.2) {
        last.text += gap > item.size * 0.15 && !last.text.endsWith(' ') && !item.str.startsWith(' ') ? ` ${item.str}` : item.str;
        last.end = Math.max(last.end, item.x + item.width);
      } else {
        cells.push({ text: item.str, x: item.x, end: item.x + item.width });
      }
    }
    return cells;
  });

  // Column anchors: cluster every cell start on the page.
  const starts = cellLines.flat().map((cell) => cell.x).sort((a, b) => a - b);
  const anchors: number[] = [];
  for (const x of starts) {
    if (!anchors.length || x - anchors[anchors.length - 1] > 12) anchors.push(x);
  }
  const columnOf = (x: number) => {
    let best = 0;
    for (let i = 0; i < anchors.length; i += 1) {
      if (Math.abs(anchors[i] - x) < Math.abs(anchors[best] - x)) best = i;
    }
    return best;
  };

  return cellLines.map((cells) => {
    const row: (string | number)[] = [];
    for (const cell of cells) {
      let column = columnOf(cell.x);
      while (row[column] !== undefined && row[column] !== '') column += 1;
      for (let i = row.length; i < column; i += 1) row[i] = '';
      row[column] = toCellValue(cell.text);
    }
    return row;
  });
}

/**
 * Extracts tabular data from PDF pages into an Excel (.xlsx) workbook, one sheet per page.
 */
export async function pdfToExcel(sourceBytes: Uint8Array): Promise<Uint8Array> {
  const opened = await openPdfView(sourceBytes);
  const wb = XLSX.utils.book_new();

  try {
    for (let i = 1; i <= opened.pageCount; i++) {
      const rows = textItemsToRows(await opened.getPageTextItems(i));
      if (!rows.length) continue;
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = Array.from({ length: Math.max(...rows.map((row) => row.length)) }, (_, column) => ({
        wch: Math.min(60, Math.max(8, ...rows.map((row) => String(row[column] ?? '').length + 2)))
      }));
      XLSX.utils.book_append_sheet(wb, ws, `Trang ${i}`);
    }
  } finally {
    opened.destroy();
  }

  if (!wb.SheetNames.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['(Không tìm thấy chữ trong PDF — có thể là bản scan)']]),
      'Trang 1'
    );
  }

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
