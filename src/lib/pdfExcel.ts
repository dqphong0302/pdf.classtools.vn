import * as XLSX from 'xlsx';
import { PDFDocument, rgb } from 'pdf-lib';
import { ensureEmbeddedFonts } from './pdfEdit';
import { openPdfView } from './pdfPreview';

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

/**
 * Extracts tabular data from PDF pages into an Excel (.xlsx) file bytes.
 */
export async function pdfToExcel(sourceBytes: Uint8Array): Promise<Uint8Array> {
  const opened = await openPdfView(sourceBytes);
  const rows: string[][] = [];

  for (let i = 1; i <= opened.pageCount; i++) {
    const text = await opened.getPageText(i);
    const lines = text.split('\n').filter((line) => line.trim().length > 0);

    for (const line of lines) {
      // Split on tabs, commas, or 2+ consecutive spaces
      let cells = line.split(/\t/);
      if (cells.length <= 1) {
        cells = line.split(/\s{2,}/);
      }
      if (cells.length <= 1 && line.includes(',')) {
        cells = line.split(',');
      }
      rows.push(cells.map((c) => c.trim()));
    }
    // Add page separator row
    if (i < opened.pageCount) {
      rows.push([`--- Trang ${i + 1} ---`]);
    }
  }

  opened.destroy();

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows.length > 0 ? rows : [['(Không tìm thấy dữ liệu văn bản)']]);
  XLSX.utils.book_append_sheet(wb, ws, 'Trích xuất PDF');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
