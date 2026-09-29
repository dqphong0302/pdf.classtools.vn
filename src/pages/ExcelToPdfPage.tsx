import { useCallback, useState } from 'react';
import { Download, FileSpreadsheet, Table } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, formatBytes, withPdfSuffix } from '../lib/download';
import { excelToPdf, parseExcelWorkbook, type ExcelSheetData } from '../lib/pdfExcel';
import './excel-to-pdf.css';

interface DocState {
  file: File;
  sheets: ExcelSheetData[];
  selectedSheet: number;
}

export function ExcelToPdfPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const [doc, setDoc] = useState<DocState | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isVi = locale === 'vi';

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setResultBytes(null);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sheets = parseExcelWorkbook(bytes);
        if (sheets.length === 0) throw new Error('NO_SHEETS');
        setDoc({ file, sheets, selectedSheet: 0 });
      } catch {
        setError(
          isVi
            ? 'Không thể đọc tệp Excel. Vui lòng kiểm tra định dạng (.xlsx, .xls, .csv).'
            : 'Unable to read Excel file. Please check format (.xlsx, .xls, .csv).'
        );
      }
    },
    [isVi]
  );

  const handleConvert = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const res = await excelToPdf(doc.sheets, doc.selectedSheet);
      setResultBytes(res);
    } catch {
      setError(isVi ? 'Lỗi khi chuyển đổi bảng tính sang PDF.' : 'Error converting spreadsheet to PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    downloadBytes(resultBytes, withPdfSuffix(doc.file.name.replace(/\.[^.]+$/, '') + '-table'));
  };

  const activeSheet = doc?.sheets[doc.selectedSheet];
  const previewRows = activeSheet?.rows.slice(0, 15) || [];

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="excel-pdf-container">

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            acceptPattern={/\.(xlsx|xls|csv)$/i}
            formatLabel="XLSX · XLS · CSV"
            label={isVi ? 'Chọn hoặc kéo thả tệp Excel (.xlsx, .xls, .csv)' : 'Choose or drop an Excel spreadsheet'}
            hint={isVi ? 'Hỗ trợ .xlsx, .xls, .csv' : 'Supports .xlsx, .xls, .csv'}
          />
        ) : (
          <div className="excel-workspace">
            <div className="file-header-card">
              <div className="file-info">
                <FileSpreadsheet className="icon" size={24} />
                <div>
                  <h3 className="file-name">{doc.file.name}</h3>
                  <p className="file-meta">
                    {formatBytes(doc.file.size)} • {doc.sheets.length} {isVi ? 'trang tính (sheets)' : 'sheets'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDoc(null)}
              >
                {isVi ? 'Đổi tệp' : 'Change file'}
              </button>
            </div>

            {/* Sheet Selector */}
            {doc.sheets.length > 1 && (
              <div className="sheet-selector-card">
                <span className="field-label">{isVi ? 'Chọn trang tính cần xuất:' : 'Select sheet to export:'}</span>
                <div className="sheet-tabs">
                  {doc.sheets.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`sheet-tab ${doc.selectedSheet === idx ? 'active' : ''}`}
                      onClick={() => setDoc((prev) => (prev ? { ...prev, selectedSheet: idx } : null))}
                    >
                      {s.name} ({s.rows.length} {isVi ? 'dòng' : 'rows'})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Table Preview */}
            <div className="table-preview-card">
              <div className="preview-head">
                <span className="preview-title">
                  <Table size={16} />
                  {isVi ? `Xem trước bảng dữ liệu (${activeSheet?.rows.length} dòng)` : `Data Table Preview (${activeSheet?.rows.length} rows)`}
                </span>
              </div>

              <div className="table-wrapper">
                <table className="excel-table">
                  <tbody>
                    {previewRows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx === 0 ? 'header-row' : ''}>
                        {row.slice(0, 10).map((cell, cIdx) => (
                          <td key={cIdx}>{cell != null ? String(cell) : ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activeSheet && activeSheet.rows.length > 15 && (
                <p className="hint" style={{ marginTop: '0.5rem' }}>
                  {isVi ? `... và ${activeSheet.rows.length - 15} dòng nữa sẽ được xuất đầy đủ sang PDF` : `... and ${activeSheet.rows.length - 15} more rows will be exported to PDF`}
                </p>
              )}
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="action-row">
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleConvert}>
                <FileSpreadsheet size={18} />
                {busy ? (isVi ? 'Đang xuất bảng sang PDF…' : 'Exporting to PDF…') : isVi ? 'Chuyển sang PDF ngay' : 'Convert to PDF'}
              </button>

              {resultBytes && (
                <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                  <Download size={18} />
                  {isVi ? 'Tải tệp PDF từ Excel' : 'Download Excel PDF'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
