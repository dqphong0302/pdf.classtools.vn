import { useCallback, useState } from 'react';
import { ArrowLeft, Download, FileText, Layers } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { flattenPdf } from '../lib/pdfFlatten';
import './flatten.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export function FlattenPage() {
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

  const handleFlatten = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const res = await flattenPdf(doc.bytes);
      setResultBytes(res);
    } catch {
      setError(isVi ? 'Lỗi khi làm phẳng PDF.' : 'Error flattening PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    downloadBytes(resultBytes, withPdfSuffix(doc.file.name.replace(/\.pdf$/i, '') + '-flattened'));
  };

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="flatten-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'Làm phẳng PDF (Flatten PDF)' : 'Flatten PDF'}</h1>
          <p>
            {isVi
              ? 'Hợp nhất toàn bộ biểu mẫu (Form fields), chữ ký và chú thích thành nội dung tĩnh của trang để ngăn chặn người khác chỉnh sửa.'
              : 'Merge fillable form fields, comments and signatures into standard page graphics to prevent tampering.'}
          </p>
        </div>

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            label={isVi ? 'Chọn hoặc kéo thả tệp PDF cần làm phẳng' : 'Choose or drop a PDF to flatten'}
            hint={isVi ? 'Một tệp PDF duy nhất' : 'A single PDF file'}
          />
        ) : (
          <div className="flatten-workspace">
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

            <div className="flatten-info-card">
              <Layers className="icon" size={32} />
              <div>
                <h4 className="info-title">
                  {isVi ? 'Bảo vệ biểu mẫu & chữ ký số' : 'Protect Forms & Annotations'}
                </h4>
                <p className="info-desc">
                  {isVi
                    ? 'Sau khi làm phẳng, toàn bộ các ô nhập dữ liệu, hộp kiểm (checkbox), ghi chú và chữ ký sẽ được ép cố định vào nền trang. Bất kỳ ai mở tệp đều không thể click vào sửa đổi nội dung form nữa.'
                    : 'Once flattened, all interactive form fields, checkboxes, markup and signatures are permanently fused into the page canvas and can no longer be edited.'}
                </p>
              </div>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="action-row">
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleFlatten}>
                <Layers size={18} />
                {busy ? (isVi ? 'Đang làm phẳng…' : 'Flattening…') : isVi ? 'Làm phẳng PDF ngay' : 'Flatten PDF'}
              </button>

              {resultBytes && (
                <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                  <Download size={18} />
                  {isVi ? 'Tải tệp PDF đã làm phẳng' : 'Download Flattened PDF'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
