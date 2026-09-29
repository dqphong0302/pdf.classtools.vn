import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, EyeOff, FileText, Trash2 } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, formatBytes, withPdfSuffix } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { openPdfView, type OpenedPdfView } from '../lib/pdfPreview';
import { redactPdf, type RedactBox, type RedactColor } from '../lib/pdfRedact';
import './redact.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

type Point = { x: number; y: number };

export function RedactPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const [doc, setDoc] = useState<DocState | null>(null);
  const [view, setView] = useState<OpenedPdfView | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [boxes, setBoxes] = useState<RedactBox[]>([]);
  const [redactColor, setRedactColor] = useState<RedactColor>('black');
  const [renderTick, setRenderTick] = useState(0);

  // Drag rectangle in canvas pixels; null when not drawing.
  const [draft, setDraft] = useState<{ start: Point; current: Point } | null>(null);

  const [busy, setBusy] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isVi = locale === 'vi';

  useEffect(() => () => view?.destroy(), [view]);

  const resetDoc = useCallback(() => {
    setDoc(null);
    setView(null);
    setBoxes([]);
    setResultBytes(null);
    setActivePage(1);
    setDraft(null);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      resetDoc();
      setError(null);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pageCount = await getPdfPageCount(bytes);
        const opened = await openPdfView(bytes);
        setView(opened);
        setDoc({ file, bytes, pageCount });
      } catch {
        setError(isVi ? 'Không thể đọc tệp PDF.' : 'Unable to read PDF.');
      }
    },
    [resetDoc, isVi]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!view || !canvas || !overlay) return;
    let cancelled = false;
    const pageInfo = view.pages[activePage - 1];
    // Render at device resolution but never wider than the page at 2×.
    const target = Math.min(pageInfo.width * 2, 860 * Math.min(window.devicePixelRatio || 1, 2));
    view
      .render(activePage, canvas, target)
      .then(() => {
        if (cancelled) return;
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        setRenderTick((tick) => tick + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [view, activePage]);

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !view) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const pageView = view.pages[activePage - 1];
    if (!pageView || !overlay.width) return;
    const scale = overlay.width / pageView.width;
    const line = Math.max(1, overlay.width / 400);

    ctx.fillStyle = redactColor === 'black' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = line;
    for (const b of boxes) {
      if (b.pageIndex !== activePage - 1) continue;
      const rect = [b.x * scale, (pageView.height - b.y - b.height) * scale, b.width * scale, b.height * scale] as const;
      ctx.fillRect(...rect);
      ctx.strokeRect(...rect);
    }

    if (draft) {
      const x = Math.min(draft.start.x, draft.current.x);
      const y = Math.min(draft.start.y, draft.current.y);
      const w = Math.abs(draft.current.x - draft.start.x);
      const h = Math.abs(draft.current.y - draft.start.y);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.setLineDash([line * 4, line * 4]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [view, activePage, boxes, draft, redactColor, renderTick]);

  // Pointer position in canvas pixels (the canvas is CSS-scaled to fit its column).
  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const overlay = event.currentTarget;
    const rect = overlay.getBoundingClientRect();
    const sx = rect.width ? overlay.width / rect.width : 1;
    const sy = rect.height ? overlay.height / rect.height : 1;
    return {
      x: Math.max(0, Math.min(overlay.width, (event.clientX - rect.left) * sx)),
      y: Math.max(0, Math.min(overlay.height, (event.clientY - rect.top) * sy))
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toCanvasPoint(event);
    setDraft({ start: point, current: point });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draft) return;
    const point = toCanvasPoint(event);
    setDraft((prev) => (prev ? { ...prev, current: point } : prev));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const overlay = event.currentTarget;
    const current = draft ? toCanvasPoint(event) : null;
    const start = draft?.start;
    setDraft(null);
    if (!start || !current || !view || !overlay.width) return;

    const pageView = view.pages[activePage - 1];
    const scale = overlay.width / pageView.width;
    const cvsX = Math.min(start.x, current.x);
    const cvsY = Math.min(start.y, current.y);
    const cvsW = Math.abs(current.x - start.x);
    const cvsH = Math.abs(current.y - start.y);
    // Ignore accidental clicks (< ~3 pt).
    if (cvsW / scale < 3 || cvsH / scale < 3) return;

    setResultBytes(null);
    setBoxes((prev) => [
      ...prev,
      {
        pageIndex: activePage - 1,
        x: cvsX / scale,
        y: pageView.height - (cvsY + cvsH) / scale,
        width: cvsW / scale,
        height: cvsH / scale
      }
    ]);
  };

  const removeBox = (idx: number) => {
    setResultBytes(null);
    setBoxes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApply = async () => {
    if (!doc) return;
    if (boxes.length === 0) {
      setError(isVi ? 'Vui lòng kéo chuột vẽ ít nhất 1 vùng cần bôi đen.' : 'Please draw at least one redaction box.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await redactPdf(doc.bytes, boxes, redactColor);
      setResultBytes(res);
    } catch {
      setError(isVi ? 'Lỗi khi bôi đen PDF.' : 'Error redacting PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    downloadBytes(resultBytes, withPdfSuffix(doc.file.name.replace(/\.pdf$/i, '') + '-redacted'));
  };

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="redact-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'Bôi đen che thông tin mật (Redact PDF)' : 'Redact PDF'}</h1>
          <p>
            {isVi
              ? 'Kéo chuột để bôi đen vĩnh viễn vùng thông tin nhạy cảm (số CCCD, tài khoản, mật khẩu) trước khi chia sẻ tài liệu.'
              : 'Permanently blackout sensitive information (ID numbers, bank details, credentials) before sharing PDFs.'}
          </p>
        </div>

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            label={isVi ? 'Chọn hoặc kéo thả tệp PDF cần che thông tin' : 'Choose or drop a PDF to redact'}
            hint={isVi ? 'Một tệp PDF duy nhất' : 'A single PDF file'}
          />
        ) : (
          <div className="redact-workspace">
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
                onClick={resetDoc}
              >
                {isVi ? 'Đổi tệp' : 'Change file'}
              </button>
            </div>

            <div className="redact-layout">
              {/* Canvas viewport */}
              <div className="redact-canvas-area">
                <div className="pagination-bar">
                  <span className="pagination-text">
                    {isVi ? `Trang ${activePage} / ${doc.pageCount}` : `Page ${activePage} of ${doc.pageCount}`}
                  </span>
                  <div className="pagination-btns">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={activePage <= 1}
                      onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                    >
                      {isVi ? 'Trang trước' : 'Previous'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={activePage >= doc.pageCount}
                      onClick={() => setActivePage((p) => Math.min(doc.pageCount, p + 1))}
                    >
                      {isVi ? 'Trang sau' : 'Next'}
                    </button>
                  </div>
                </div>

                <div className="canvas-stack">
                  <canvas ref={canvasRef} className="base-canvas" />
                  <canvas
                    ref={overlayCanvasRef}
                    className="overlay-canvas"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={() => setDraft(null)}
                  />
                </div>
                <p className="canvas-hint">
                  {isVi
                    ? '💡 Nhấn giữ và kéo (chuột hoặc ngón tay) trên trang để tạo vùng che. Trang có vùng che sẽ được chuyển thành ảnh để xoá hẳn chữ bên dưới.'
                    : '💡 Click or touch and drag on the page to draw a box. Redacted pages are flattened to images so the text underneath is removed for good.'}
                </p>
              </div>

              {/* Sidebar */}
              <div className="redact-sidebar">
                <h4 className="sidebar-title">
                  <EyeOff size={18} />
                  {isVi ? 'Cài đặt bôi đen' : 'Redaction Settings'}
                </h4>

                <div className="field-group">
                  <label className="field-label">{isVi ? 'Màu vùng che' : 'Redaction Color'}</label>
                  <div className="color-toggle">
                    <button
                      type="button"
                      className={`color-btn ${redactColor === 'black' ? 'active' : ''}`}
                      onClick={() => {
                        setRedactColor('black');
                        setResultBytes(null);
                      }}
                    >
                      {isVi ? 'Bôi đen' : 'Blackout'}
                    </button>
                    <button
                      type="button"
                      className={`color-btn ${redactColor === 'white' ? 'active' : ''}`}
                      onClick={() => {
                        setRedactColor('white');
                        setResultBytes(null);
                      }}
                    >
                      {isVi ? 'Xóa trắng' : 'Whiteout'}
                    </button>
                  </div>
                </div>

                <div className="boxes-list-section">
                  <div className="section-head">
                    <span className="field-label">{isVi ? `Vùng đã chọn (${boxes.length})` : `Boxes (${boxes.length})`}</span>
                    {boxes.length > 0 && (
                      <button type="button" className="text-btn" onClick={() => {
                        setResultBytes(null);
                        setBoxes([]);
                      }}>
                        {isVi ? 'Xóa hết' : 'Clear all'}
                      </button>
                    )}
                  </div>

                  <div className="boxes-list">
                    {boxes.map((box, i) => (
                      <div key={i} className="box-item">
                        <span>
                          {isVi ? `Trang ${box.pageIndex + 1}` : `Page ${box.pageIndex + 1}`}: {Math.round(box.width)}×{Math.round(box.height)}pt
                        </span>
                        <button type="button" className="icon-btn" onClick={() => removeBox(i)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {boxes.length === 0 && (
                      <p className="empty-hint">{isVi ? 'Chưa vẽ vùng nào.' : 'No redactions drawn.'}</p>
                    )}
                  </div>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleApply}>
                    {busy ? (isVi ? 'Đang che vĩnh viễn…' : 'Redacting…') : isVi ? 'Áp dụng che vĩnh viễn' : 'Apply Redactions'}
                  </button>
                  {resultBytes && (
                    <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                      <Download size={18} />
                      {isVi ? 'Tải tệp đã che mật' : 'Download Redacted PDF'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
