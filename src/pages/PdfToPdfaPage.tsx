import { useCallback, useState } from 'react';
import { Archive, ArrowLeft, Download, FileText, ShieldCheck } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { convertToPdfa } from '../lib/wasmGhostscript';
import './pdf-to-pdfa.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export function PdfToPdfaPage() {
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
      const res = await convertToPdfa(doc.bytes);
      setResultBytes(res);
    } catch {
      setError(
        isVi
          ? 'Lỗi khi chuẩn hóa PDF/A bằng Ghostscript WebAssembly.'
          : 'Error converting to PDF/A via Ghostscript WASM.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    downloadBytes(resultBytes, withPdfSuffix(doc.file.name.replace(/\.pdf$/i, '') + '-pdfa'));
  };

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="pdfa-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'PDF sang PDF/A (Chuẩn lưu trữ ISO)' : 'PDF to PDF/A'}</h1>
          <p>
            {isVi
              ? 'Chuyển đổi tài liệu PDF thông thường sang chuẩn lưu trữ dài hạn ISO 19005 (PDF/A-2b), nhúng trọn bộ font và cấu hình màu độc lập.'
              : 'Convert standard PDFs into long-term archival ISO 19005 (PDF/A-2b) compliant files with device-independent colors and embedded fonts.'}
          </p>
        </div>

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            label={isVi ? 'Chọn hoặc kéo thả tệp PDF cần chuyển sang PDF/A' : 'Choose or drop a PDF to convert to PDF/A'}
            hint={isVi ? 'Một tệp PDF duy nhất' : 'A single PDF file'}
          />
        ) : (
          <div className="pdfa-workspace">
            <div className="file-header-card">
              <div className="file-info">
                <FileText className="icon" size={24} />
                <div>
                  <h3 className="file-name">{doc.file.name}</h3>
                  <p className="file-meta">
                    {fileSummary(doc.file)} • {doc.pageCount} {isVi ? 'trang' : 'pages'}
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

            <div className="pdfa-info-box">
              <ShieldCheck className="icon" size={32} />
              <div>
                <h4 className="info-title">
                  {isVi ? 'Chuẩn lưu trữ ISO 19005-2 (PDF/A-2b)' : 'ISO 19005-2 (PDF/A-2b) Standard'}
                </h4>
                <p className="info-desc">
                  {isVi
                    ? 'Tệp PDF/A đảm bảo hiển thị đồng nhất chính xác 100% trong nhiều thập kỷ tới bất kể phần mềm nào mở tệp, bắt buộc dùng cho hồ sơ pháp lý, luận văn, bệnh án điện tử và lưu trữ văn thư.'
                    : 'PDF/A ensures the visual appearance of your document remains 100% identical decades into the future, required for legal, academic, healthcare and government archives.'}
                </p>
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="action-row">
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleConvert}>
                <Archive size={18} />
                {busy ? (isVi ? 'Đang chuẩn hóa PDF/A…' : 'Converting to PDF/A…') : isVi ? 'Chuyển sang PDF/A ngay' : 'Convert to PDF/A'}
              </button>

              {resultBytes && (
                <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                  <Download size={18} />
                  {isVi ? 'Tải tệp PDF/A chuẩn ISO' : 'Download ISO PDF/A'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
