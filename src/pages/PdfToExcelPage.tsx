import { useCallback, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { baseName, downloadBytes, formatBytes } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { pdfToExcel } from '../lib/pdfExcel';
import './pdf-to-excel.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export function PdfToExcelPage() {
  const { locale } = usePreferences();
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
        const pageCount = await getPdfPageCount(bytes);
        setDoc({ file, bytes, pageCount });
      } catch {
        setError(isVi ? 'Không thể đọc tệp PDF.' : 'Unable to read PDF.');
      }
    },
    [isVi]
  );

  const handleConvert = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const res = await pdfToExcel(doc.bytes);
      setResultBytes(res);
    } catch {
      setError(isVi ? 'Lỗi khi trích xuất dữ liệu sang Excel.' : 'Error extracting data to Excel.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    const xlsxName = baseName(doc.file.name) + '.xlsx';
    downloadBytes(resultBytes, xlsxName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  return (
    <ToolShell>
      <div className="pdf-excel-container">

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            label={isVi ? 'Chọn hoặc kéo thả tệp PDF cần chuyển sang Excel' : 'Choose or drop a PDF to convert to Excel'}
            hint={isVi ? 'Một tệp PDF duy nhất' : 'A single PDF file'}
          />
        ) : (
          <div className="pdf-excel-workspace">
            <div className="file-header-card">
              <div className="file-info">
                <FileText className="icon" size={24} />
                <div>
                  <h3 className="file-name">{doc.file.name}</h3>
                  <p className="file-meta">
                    {formatBytes(doc.file.size)} • {doc.pageCount} {isVi ? 'trang' : 'pages'}
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

            <div className="excel-info-card">
              <FileSpreadsheet className="icon" size={32} />
              <div>
                <h4 className="info-title">
                  {isVi ? 'Trích xuất cấu trúc bảng sang định dạng .xlsx' : 'Extract Table Structure to .xlsx'}
                </h4>
                <p className="info-desc">
                  {isVi
                    ? 'Hệ thống tự động nhận diện các cột, dấu phân cách tab và khoảng cách giữa các trường dữ liệu trên từng trang của PDF để phân chia thành các ô ô tính Excel tương ứng.'
                    : 'The tool parses tabular columns, tabs and multi-space delimiters from all pages and populates corresponding Excel cells.'}
                </p>
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="action-row">
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleConvert}>
                <FileSpreadsheet size={18} />
                {busy ? (isVi ? 'Đang trích xuất sang Excel…' : 'Extracting to Excel…') : isVi ? 'Trích xuất sang Excel ngay' : 'Convert to Excel'}
              </button>

              {resultBytes && (
                <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                  <Download size={18} />
                  {isVi ? 'Tải tệp bảng tính Excel (.xlsx)' : 'Download Excel (.xlsx)'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
