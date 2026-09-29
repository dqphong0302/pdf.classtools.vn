import { useCallback, useState } from 'react';
import { ArrowLeft, Download, FileText, Wrench } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, formatBytes, withPdfSuffix } from '../lib/download';
import { repairPdf } from '../lib/wasmQpdf';
import './repair.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
}

export function RepairPage() {
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
        setDoc({ file, bytes });
      } catch {
        setError(isVi ? 'Không thể đọc tệp.' : 'Unable to read file.');
      }
    },
    [isVi]
  );

  const handleRepair = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const res = await repairPdf(doc.bytes);
      setResultBytes(res);
    } catch {
      setError(
        isVi
          ? 'Không thể phục hồi tệp. Tệp có thể đã bị hỏng quá nặng hoặc không phải định dạng PDF.'
          : 'Unable to repair file. File may be severely corrupted or not a valid PDF.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    downloadBytes(resultBytes, withPdfSuffix(doc.file.name.replace(/\.pdf$/i, '') + '-repaired'));
  };

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="repair-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'Sửa lỗi PDF (Repair PDF)' : 'Repair PDF'}</h1>
          <p>
            {isVi
              ? 'Khắc phục các lỗi tệp PDF không mở được, hỏng bảng tham chiếu chéo (xref table) hoặc luồng stream bị lỗi bằng QPDF WebAssembly.'
              : 'Recover corrupted or unreadable PDF files by rebuilding damaged xref tables and linearized streams with QPDF WASM.'}
          </p>
        </div>

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            label={isVi ? 'Chọn hoặc kéo thả tệp PDF bị lỗi' : 'Choose or drop a damaged PDF'}
            hint={isVi ? 'Một tệp PDF duy nhất' : 'A single PDF file'}
          />
        ) : (
          <div className="repair-workspace">
            <div className="file-header-card">
              <div className="file-info">
                <FileText className="icon" size={24} />
                <div>
                  <h3 className="file-name">{doc.file.name}</h3>
                  <p className="file-meta">{formatBytes(doc.file.size)}</p>
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

            <div className="repair-info-box">
              <Wrench className="icon" size={32} />
              <div>
                <h4 className="info-title">
                  {isVi ? 'Cơ chế phục hồi tệp hỏng' : 'Recovery Mechanism'}
                </h4>
                <p className="info-desc">
                  {isVi
                    ? 'Bộ công cụ phân tích lại cây đối tượng (Object Tree), loại bỏ các tham chiếu vòng, tái cấu trúc bảng xref bị mất và tối ưu hóa luồng trang để tệp có thể mở lại bình thường trên Acrobat, Chrome và Preview.'
                    : 'The tool reconstructs object trees, strips broken references, regenerates missing cross-reference tables and restores standard PDF stream structures.'}
                </p>
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="action-row">
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleRepair}>
                <Wrench size={18} />
                {busy ? (isVi ? 'Đang phân tích & sửa tệp…' : 'Repairing…') : isVi ? 'Sửa lỗi tệp ngay' : 'Repair PDF'}
              </button>

              {resultBytes && (
                <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                  <Download size={18} />
                  {isVi ? 'Tải tệp PDF đã sửa' : 'Download Repaired PDF'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
