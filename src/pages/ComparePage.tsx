import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Columns, Eye, FileText } from 'lucide-react';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { getPdfPageCount } from '../lib/pdfOps';
import { openPdfView, type OpenedPdfView } from '../lib/pdfPreview';
import { computeVisualDiff, type CompareResult } from '../lib/pdfCompare';
import './compare.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export function ComparePage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const [docA, setDocA] = useState<DocState | null>(null);
  const [docB, setDocB] = useState<DocState | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [viewMode, setViewMode] = useState<'diff' | 'sideBySide'>('diff');
  const [diffStats, setDiffStats] = useState<CompareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewARef = useRef<OpenedPdfView | null>(null);
  const viewBRef = useRef<OpenedPdfView | null>(null);

  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);
  const canvasDiffRef = useRef<HTMLCanvasElement | null>(null);

  const isVi = locale === 'vi';

  const cleanup = useCallback(() => {
    viewARef.current?.destroy();
    viewBRef.current?.destroy();
    viewARef.current = null;
    viewBRef.current = null;
  }, []);

  const handleFileA = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await getPdfPageCount(bytes);
      viewARef.current?.destroy();
      viewARef.current = await openPdfView(bytes);
      setDocA({ file, bytes, pageCount });
    } catch {
      setError(isVi ? 'Không thể đọc tệp PDF A.' : 'Unable to read PDF A.');
    }
  };

  const handleFileB = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pageCount = await getPdfPageCount(bytes);
      viewBRef.current?.destroy();
      viewBRef.current = await openPdfView(bytes);
      setDocB({ file, bytes, pageCount });
    } catch {
      setError(isVi ? 'Không thể đọc tệp PDF B.' : 'Unable to read PDF B.');
    }
  };

  const runComparison = useCallback(async () => {
    if (!docA || !docB || !viewARef.current || !viewBRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const targetWidth = 420;

      // Render Page of A
      if (canvasARef.current && activePage <= docA.pageCount) {
        await viewARef.current.render(activePage, canvasARef.current, targetWidth);
      }
      // Render Page of B
      if (canvasBRef.current && activePage <= docB.pageCount) {
        await viewBRef.current.render(activePage, canvasBRef.current, targetWidth);
      }

      // Compute visual difference
      if (canvasARef.current && canvasBRef.current && canvasDiffRef.current) {
        const ctxA = canvasARef.current.getContext('2d');
        const ctxB = canvasBRef.current.getContext('2d');
        const ctxDiff = canvasDiffRef.current.getContext('2d');

        if (ctxA && ctxB && ctxDiff) {
          const w = Math.min(canvasARef.current.width, canvasBRef.current.width);
          const h = Math.min(canvasARef.current.height, canvasBRef.current.height);

          canvasDiffRef.current.width = w;
          canvasDiffRef.current.height = h;

          const imgA = ctxA.getImageData(0, 0, w, h);
          const imgB = ctxB.getImageData(0, 0, w, h);

          const result = computeVisualDiff(imgA, imgB, ctxDiff);
          setDiffStats(result);
        }
      }
    } catch {
      setError(isVi ? 'Lỗi khi so sánh trang.' : 'Error comparing pages.');
    } finally {
      setBusy(false);
    }
  }, [docA, docB, activePage, isVi]);

  useEffect(() => {
    if (docA && docB) {
      runComparison().catch(() => {});
    }
  }, [docA, docB, activePage, runComparison]);

  const maxPages = Math.max(docA?.pageCount || 1, docB?.pageCount || 1);

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="compare-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'So sánh 2 tệp PDF (Compare PDF)' : 'Compare PDF'}</h1>
          <p>
            {isVi
              ? 'So sánh trực quan hai phiên bản tài liệu PDF, làm nổi bật chính xác từng thay đổi và hiển thị tỷ lệ khác biệt.'
              : 'Visually compare two PDF documents, highlight exact pixel changes and view difference percentages.'}
          </p>
        </div>

        {(!docA || !docB) && (
          <div className="upload-dual-grid">
            <div className="upload-box">
              <h4 className="upload-title">{isVi ? '1. Tài liệu A (Bản gốc)' : '1. Document A (Original)'}</h4>
              {docA ? (
                <div className="uploaded-info">
                  <FileText className="icon" size={20} />
                  <div>
                    <span className="file-name">{docA.file.name}</span>
                    <span className="file-meta">
                      {docA.pageCount} {isVi ? 'trang' : 'pages'}
                    </span>
                  </div>
                </div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => e.target.files?.[0] && handleFileA(e.target.files[0])}
                />
              )}
            </div>

            <div className="upload-box">
              <h4 className="upload-title">{isVi ? '2. Tài liệu B (Bản chỉnh sửa)' : '2. Document B (Modified)'}</h4>
              {docB ? (
                <div className="uploaded-info">
                  <FileText className="icon" size={20} />
                  <div>
                    <span className="file-name">{docB.file.name}</span>
                    <span className="file-meta">
                      {docB.pageCount} {isVi ? 'trang' : 'pages'}
                    </span>
                  </div>
                </div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => e.target.files?.[0] && handleFileB(e.target.files[0])}
                />
              )}
            </div>
          </div>
        )}

        {docA && docB && (
          <div className="compare-workspace">
            {/* Toolbar */}
            <div className="compare-toolbar">
              <div className="mode-toggle">
                <button
                  type="button"
                  className={`btn btn-sm ${viewMode === 'diff' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode('diff')}
                >
                  <Eye size={16} />
                  {isVi ? 'Lớp phủ khác biệt (Diff Overlay)' : 'Diff Overlay'}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${viewMode === 'sideBySide' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode('sideBySide')}
                >
                  <Columns size={16} />
                  {isVi ? 'Song song 2 bên (Side-by-side)' : 'Side by Side'}
                </button>
              </div>

              <div className="page-nav">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={activePage <= 1}
                  onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                >
                  {isVi ? 'Trang trước' : 'Previous'}
                </button>
                <span className="page-indicator">
                  {isVi ? `Trang ${activePage} / ${maxPages}` : `Page ${activePage} of ${maxPages}`}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={activePage >= maxPages}
                  onClick={() => setActivePage((p) => Math.min(maxPages, p + 1))}
                >
                  {isVi ? 'Trang sau' : 'Next'}
                </button>
              </div>

              {busy && (
                <div className="diff-badge" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                  {isVi ? 'Đang so sánh…' : 'Comparing…'}
                </div>
              )}
              {diffStats && !busy && (
                <div className="diff-badge">
                  {isVi
                    ? `Khác biệt: ${diffStats.mismatchPercentage.toFixed(2)}%`
                    : `Difference: ${diffStats.mismatchPercentage.toFixed(2)}%`}
                </div>
              )}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  cleanup();
                  setDocA(null);
                  setDocB(null);
                }}
              >
                {isVi ? 'Đổi tệp khác' : 'Change files'}
              </button>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {/* Display Area */}
            {viewMode === 'diff' ? (
              <div className="diff-view-card">
                <span className="view-title">
                  {isVi
                    ? '🔴 Vùng màu đỏ thể hiện nội dung khác biệt giữa 2 tài liệu'
                    : '🔴 Red areas highlight exact differences between Document A & B'}
                </span>
                <div className="canvas-frame">
                  <canvas ref={canvasDiffRef} />
                </div>
              </div>
            ) : (
              <div className="side-by-side-grid">
                <div className="doc-col">
                  <h4 className="doc-col-title">{isVi ? 'Bản gốc (A)' : 'Original (A)'}</h4>
                  <div className="canvas-frame">
                    <canvas ref={canvasARef} />
                  </div>
                </div>
                <div className="doc-col">
                  <h4 className="doc-col-title">{isVi ? 'Bản chỉnh sửa (B)' : 'Modified (B)'}</h4>
                  <div className="canvas-frame">
                    <canvas ref={canvasBRef} />
                  </div>
                </div>
              </div>
            )}

            {/* Hidden canvas for side-by-side data extraction when in diff mode */}
            <div style={{ display: 'none' }}>
              <canvas ref={canvasARef} />
              <canvas ref={canvasBRef} />
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
