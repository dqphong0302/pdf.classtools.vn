import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, EyeOff, FileText, Trash2 } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { openPdfView, type OpenedPdfView } from '../lib/pdfPreview';
import { redactPdf, type RedactBox } from '../lib/pdfRedact';
import './redact.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export function RedactPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const [doc, setDoc] = useState<DocState | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [boxes, setBoxes] = useState<RedactBox[]>([]);
  const [redactColor, setRedactColor] = useState<'black' | 'white'>('black');

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  const [busy, setBusy] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<OpenedPdfView | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
      setBoxes([]);
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

  const renderActivePage = useCallback(async () => {
    if (!doc || !previewRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    await previewRef.current.render(activePage, canvas, 560);

    // Sync overlay canvas size
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = canvas.width;
      overlayCanvasRef.current.height = canvas.height;
      drawBoxes();
    }
  }, [doc, activePage]);

  useEffect(() => {
    renderActivePage().catch(() => {});
  }, [renderActivePage]);

  const drawBoxes = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !previewRef.current) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const pageView = previewRef.current.pages[activePage - 1];
    if (!pageView) return;
    const scale = overlay.width / pageView.width;

    // Draw saved boxes for this page
    const pageBoxes = boxes.filter((b) => b.pageIndex === activePage - 1);
    ctx.fillStyle = redactColor === 'black' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;

    for (const b of pageBoxes) {
      // PDF bottom-left to canvas top-left
      const cvsX = b.x * scale;
      const cvsY = (pageView.height - b.y - b.height) * scale;
      const cvsW = b.width * scale;
      const cvsH = b.height * scale;

      ctx.fillRect(cvsX, cvsY, cvsW, cvsH);
      ctx.strokeRect(cvsX, cvsY, cvsW, cvsH);
    }

    // Draw active drawing box
    if (isDrawing && startPos && currentPos) {
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const w = Math.abs(currentPos.x - startPos.x);
      const h = Math.abs(currentPos.y - startPos.y);

      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.strokeStyle = '#ef4444';
      ctx.setLineDash([4, 4]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [activePage, boxes, isDrawing, startPos, currentPos, redactColor]);

  useEffect(() => {
    drawBoxes();
  }, [drawBoxes]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(coords);
    setCurrentPos(coords);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setCurrentPos(getCanvasCoords(e));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentPos || !previewRef.current || !overlayCanvasRef.current) {
      setIsDrawing(false);
      return;
    }
    const pageView = previewRef.current.pages[activePage - 1];
    const scale = overlayCanvasRef.current.width / pageView.width;

    const cvsX = Math.min(startPos.x, currentPos.x);
    const cvsY = Math.min(startPos.y, currentPos.y);
    const cvsW = Math.abs(currentPos.x - startPos.x);
    const cvsH = Math.abs(currentPos.y - startPos.y);

    if (cvsW > 5 && cvsH > 5) {
      // Convert to PDF coordinates (pt, bottom-left origin)
      const pdfX = cvsX / scale;
      const pdfH = cvsH / scale;
      const pdfW = cvsW / scale;
      const pdfY = pageView.height - (cvsY + cvsH) / scale;

      setBoxes((prev) => [
        ...prev,
        {
          pageIndex: activePage - 1,
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH
        }
      ]);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };

  const removeBox = (idx: number) => {
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
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  />
                </div>
                <p className="canvas-hint">
                  {isVi
                    ? '💡 Nhấn giữ và kéo chuột trên trang để tạo vùng bôi đen'
                    : '💡 Click and drag on the page to draw a blackout redaction box'}
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
                      onClick={() => setRedactColor('black')}
                    >
                      {isVi ? 'Bôi đen' : 'Blackout'}
                    </button>
                    <button
                      type="button"
                      className={`color-btn ${redactColor === 'white' ? 'active' : ''}`}
                      onClick={() => setRedactColor('white')}
                    >
                      {isVi ? 'Xóa trắng' : 'Whiteout'}
                    </button>
                  </div>
                </div>

                <div className="boxes-list-section">
                  <div className="section-head">
                    <span className="field-label">{isVi ? `Vùng đã chọn (${boxes.length})` : `Boxes (${boxes.length})`}</span>
                    {boxes.length > 0 && (
                      <button type="button" className="text-btn" onClick={() => setBoxes([])}>
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
