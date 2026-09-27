import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, FileText, Hash } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { addPageNumbers, type PageNumberPosition } from '../lib/pdfPageNumbers';
import { openPdfView, type OpenedPdfView } from '../lib/pdfPreview';
import './page-numbers.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export function PageNumbersPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const [doc, setDoc] = useState<DocState | null>(null);
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [format, setFormat] = useState('Trang {n} / {total}');
  const [startFrom, setStartFrom] = useState(1);
  const [firstPage, setFirstPage] = useState(1);
  const [fontSize, setFontSize] = useState(10);
  const [colorHex, setColorHex] = useState('#475569');
  const [marginPt, setMarginPt] = useState(24);

  const [busy, setBusy] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<OpenedPdfView | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isVi = locale === 'vi';

  const cleanup = useCallback(() => {
    previewRef.current?.destroy();
    previewRef.current = null;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      cleanup();
      setError(null);
      setResultBytes(null);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pageCount = await getPdfPageCount(bytes);
        setDoc({ file, bytes, pageCount });
        const view = await openPdfView(bytes);
        previewRef.current = view;
      } catch {
        setError(isVi ? 'Không thể đọc tệp PDF.' : 'Unable to read PDF.');
      }
    },
    [cleanup, isVi]
  );

  useEffect(() => {
    if (!doc || !previewRef.current || !canvasRef.current) return;
    previewRef.current.render(1, canvasRef.current, 280).catch(() => {});
  }, [doc]);

  const handleApply = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addPageNumbers(doc.bytes, {
        position,
        format,
        startFrom,
        firstPageToNumber: firstPage,
        fontSize,
        colorHex,
        marginPt
      });
      setResultBytes(res);
    } catch {
      setError(isVi ? 'Lỗi khi đánh số trang.' : 'Error adding page numbers.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    downloadBytes(resultBytes, withPdfSuffix(doc.file.name.replace(/\.pdf$/i, '') + '-numbered'));
  };

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="page-numbers-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'Đánh số trang PDF' : 'Add Page Numbers'}</h1>
          <p>
            {isVi
              ? 'Đánh số trang tự động vào tài liệu PDF, tùy biến vị trí, định dạng chữ và bỏ qua trang bìa.'
              : 'Automatically add page numbers to PDF documents with custom position, format and cover page skipping.'}
          </p>
        </div>

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            label={isVi ? 'Chọn hoặc kéo thả tệp PDF cần đánh số trang' : 'Drop or choose a PDF to add page numbers'}
            hint={isVi ? 'Một tệp PDF duy nhất' : 'A single PDF file'}
          />
        ) : (
          <div className="pn-workspace">
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
                onClick={() => {
                  cleanup();
                  setDoc(null);
                }}
              >
                {isVi ? 'Đổi tệp' : 'Change file'}
              </button>
            </div>

            <div className="pn-content-layout">
              {/* Settings panel */}
              <div className="pn-settings-panel">
                <h4 className="section-title">{isVi ? '1. Vị trí đánh số trang' : '1. Page number position'}</h4>
                <div className="position-grid">
                  {[
                    ['top-left', isVi ? 'Trên trái' : 'Top Left'],
                    ['top-center', isVi ? 'Trên giữa' : 'Top Center'],
                    ['top-right', isVi ? 'Trên phải' : 'Top Right'],
                    ['bottom-left', isVi ? 'Dưới trái' : 'Bottom Left'],
                    ['bottom-center', isVi ? 'Dưới giữa' : 'Bottom Center'],
                    ['bottom-right', isVi ? 'Dưới phải' : 'Bottom Right']
                  ].map(([posKey, posLabel]) => (
                    <button
                      key={posKey}
                      type="button"
                      className={`pos-box ${position === posKey ? 'active' : ''}`}
                      onClick={() => setPosition(posKey as PageNumberPosition)}
                    >
                      {posLabel}
                    </button>
                  ))}
                </div>

                <h4 className="section-title" style={{ marginTop: '1.25rem' }}>
                  {isVi ? '2. Định dạng chữ' : '2. Text Format'}
                </h4>
                <div className="field-group">
                  <label className="field-label">{isVi ? 'Kiểu hiển thị' : 'Format Template'}</label>
                  <select
                    className="select-input"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <option value="Trang {n} / {total}">Trang &#123;n&#125; / &#123;total&#125;</option>
                    <option value="Page {n} of {total}">Page &#123;n&#125; of &#123;total&#125;</option>
                    <option value="{n} / {total}">&#123;n&#125; / &#123;total&#125;</option>
                    <option value="{n}">Chỉ số trang: &#123;n&#125;</option>
                    <option value="- {n} -">- &#123;n&#125; -</option>
                  </select>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label className="field-label">{isVi ? 'Bắt đầu từ trang' : 'First page to number'}</label>
                    <input
                      type="number"
                      className="text-input"
                      min={1}
                      max={doc.pageCount}
                      value={firstPage}
                      onChange={(e) => setFirstPage(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                    <small className="hint">{isVi ? '(Đặt là 2 để bỏ qua bìa)' : '(Set 2 to skip cover)'}</small>
                  </div>

                  <div className="field-group">
                    <label className="field-label">{isVi ? 'Số khởi đầu' : 'Start counting from'}</label>
                    <input
                      type="number"
                      className="text-input"
                      min={1}
                      value={startFrom}
                      onChange={(e) => setStartFrom(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label className="field-label">{isVi ? 'Cỡ chữ (pt)' : 'Font size (pt)'}</label>
                    <input
                      type="number"
                      className="text-input"
                      min={6}
                      max={24}
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 10)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">{isVi ? 'Màu chữ' : 'Color'}</label>
                    <input
                      type="color"
                      className="color-input"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">{isVi ? `Khoảng cách lề (${marginPt} pt)` : `Margin offset (${marginPt} pt)`}</label>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    value={marginPt}
                    onChange={(e) => setMarginPt(parseInt(e.target.value, 10) || 24)}
                  />
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleApply}>
                    <Hash size={18} />
                    {busy ? (isVi ? 'Đang xử lý…' : 'Applying…') : isVi ? 'Đánh số trang và lưu' : 'Apply & Save'}
                  </button>
                  {resultBytes && (
                    <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                      <Download size={18} />
                      {isVi ? 'Tải tệp PDF đã đánh số' : 'Download numbered PDF'}
                    </button>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="pn-preview-panel">
                <span className="preview-label">{isVi ? 'Xem trước mẫu trang 1' : 'Page 1 Preview'}</span>
                <div className="preview-box">
                  <canvas ref={canvasRef} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
