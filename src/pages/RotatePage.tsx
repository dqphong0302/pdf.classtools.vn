import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, RotateCcw, RotateCw } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { baseName, downloadBytes, formatBytes, withPdfSuffix } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { openPdfView, type OpenedPdfView } from '../lib/pdfPreview';
import { rotatePdfPages } from '../lib/pdfRotate';
import './rotate.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
  pageSizes: { width: number; height: number }[];
}

export function RotatePage() {
  const { locale } = usePreferences();
  const [doc, setDoc] = useState<DocState | null>(null);
  const [rotations, setRotations] = useState<Map<number, number>>(new Map());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ bytes: Uint8Array; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<OpenedPdfView | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const isVi = locale === 'vi';

  const cleanup = useCallback(() => {
    previewRef.current?.destroy();
    previewRef.current = null;
    canvasRefs.current = [];
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      cleanup();
      setError(null);
      setResult(null);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pageCount = await getPdfPageCount(bytes);
        const map = new Map<number, number>();
        for (let i = 0; i < pageCount; i++) map.set(i, 0);

        setRotations(map);
        const view = await openPdfView(bytes);
        previewRef.current = view;
        setDoc({ file, bytes, pageCount, pageSizes: view.pages.map(({ width, height }) => ({ width, height })) });
      } catch {
        setError(isVi ? 'Không thể đọc tệp PDF. Tệp có thể bị hỏng hoặc có mật khẩu.' : 'Unable to read PDF file.');
      }
    },
    [cleanup, isVi]
  );

  useEffect(() => {
    if (!doc || !previewRef.current) return;
    const view = previewRef.current;
    for (let i = 0; i < doc.pageCount; i++) {
      const canvas = canvasRefs.current[i];
      if (canvas) {
        view.render(i + 1, canvas, 140).catch(() => {});
      }
    }
  }, [doc]);

  const rotateAll = (delta: number) => {
    if (!doc) return;
    setRotations((prev) => {
      const next = new Map(prev);
      for (let i = 0; i < doc.pageCount; i++) {
        const cur = next.get(i) || 0;
        let target = (cur + delta) % 360;
        if (target < 0) target += 360;
        next.set(i, target);
      }
      return next;
    });
  };

  const rotateSingle = (idx: number, delta: number) => {
    setRotations((prev) => {
      const next = new Map(prev);
      const cur = next.get(idx) || 0;
      let target = (cur + delta) % 360;
      if (target < 0) target += 360;
      next.set(idx, target);
      return next;
    });
  };

  // A result is only offered while it still matches the current rotations.
  const settingsKey = JSON.stringify([...rotations]);
  const resultBytes = result?.key === settingsKey ? result.bytes : null;

  const handleApply = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const res = await rotatePdfPages(doc.bytes, rotations);
      setResult({ bytes: res, key: settingsKey });
    } catch {
      setError(isVi ? 'Lỗi khi xoay PDF.' : 'Error rotating PDF.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    downloadBytes(resultBytes, withPdfSuffix(baseName(doc.file.name) + '-rotated'));
  };

  return (
    <ToolShell>
      <div className="rotate-container">

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            label={isVi ? 'Chọn hoặc kéo thả tệp PDF cần xoay' : 'Choose or drop a PDF to rotate'}
            hint={isVi ? 'Một tệp PDF duy nhất' : 'A single PDF file'}
          />
        ) : (
          <div className="rotate-workspace">
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
                onClick={() => {
                  cleanup();
                  setDoc(null);
                }}
              >
                {isVi ? 'Đổi tệp' : 'Change file'}
              </button>
            </div>

            <div className="rotate-toolbar">
              <span className="toolbar-title">{isVi ? 'Xoay hàng loạt:' : 'Batch rotate:'}</span>
              <button type="button" className="btn btn-secondary" onClick={() => rotateAll(90)}>
                <RotateCw size={16} />
                {isVi ? 'Xoay phải 90°' : 'Right 90°'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => rotateAll(-90)}>
                <RotateCcw size={16} />
                {isVi ? 'Xoay trái 90°' : 'Left 90°'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => rotateAll(180)}>
                <RotateCw size={16} />
                180°
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const m = new Map<number, number>();
                  for (let i = 0; i < doc.pageCount; i++) m.set(i, 0);
                  setRotations(m);
                }}
              >
                {isVi ? 'Đặt lại' : 'Reset'}
              </button>
            </div>

            <div className="pages-grid">
              {Array.from({ length: doc.pageCount }, (_, i) => {
                const angle = rotations.get(i) || 0;
                const info = doc.pageSizes[i];
                // A quarter turn swaps width/height; shrink so the thumbnail stays inside its card.
                const fit = info && angle % 180 !== 0 ? Math.min(info.width, info.height) / Math.max(info.width, info.height) : 1;
                return (
                  <div key={i} className="page-card">
                    <div
                      className="canvas-wrapper"
                      style={{
                        transform: `rotate(${angle}deg) scale(${fit})`,
                        transition: 'transform 0.2s ease-in-out'
                      }}
                    >
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[i] = el;
                        }}
                      />
                    </div>
                    <div className="page-footer">
                      <span className="page-idx">
                        {isVi ? `Trang ${i + 1}` : `Page ${i + 1}`}
                        {angle > 0 && <span className="angle-badge">+{angle}°</span>}
                      </span>
                      <div className="page-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title={isVi ? 'Xoay trái' : 'Rotate left'}
                          onClick={() => rotateSingle(i, -90)}
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title={isVi ? 'Xoay phải' : 'Rotate right'}
                          onClick={() => rotateSingle(i, 90)}
                        >
                          <RotateCw size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="action-row">
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleApply}>
                {busy ? (isVi ? 'Đang xoay…' : 'Rotating…') : isVi ? 'Áp dụng và lưu PDF' : 'Apply & Save PDF'}
              </button>

              {resultBytes && (
                <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                  <Download size={18} />
                  {isVi ? 'Tải tệp đã xoay' : 'Download rotated PDF'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
