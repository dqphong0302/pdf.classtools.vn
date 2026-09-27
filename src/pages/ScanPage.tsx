import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Download, Trash2 } from 'lucide-react';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes } from '../lib/download';
import { PDFDocument } from 'pdf-lib';
import './scan.css';

interface ScannedPage {
  id: string;
  dataUrl: string;
  blob: Blob;
  filter: 'color' | 'bw' | 'grayscale';
}

export function ScanPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [filter, setFilter] = useState<'color' | 'bw' | 'grayscale'>('color');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isVi = locale === 'vi';

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch {
      setCameraError(
        isVi
          ? 'Không thể truy cập máy ảnh. Vui lòng cấp quyền Camera trên trình duyệt.'
          : 'Unable to access camera. Please grant camera permissions.'
      );
    }
  }, [isVi]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply Filter
    if (filter === 'grayscale' || filter === 'bw') {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const threshold = 128;
      for (let i = 0; i < data.length; i += 4) {
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (filter === 'bw') {
          const val = avg > threshold ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        } else {
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const newPage: ScannedPage = {
          id: Math.random().toString(36).substring(2, 9),
          dataUrl,
          blob,
          filter
        };
        setPages((prev) => [...prev, newPage]);
      },
      'image/jpeg',
      0.9
    );
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const handleGeneratePdf = async () => {
    if (pages.length === 0) {
      setError(isVi ? 'Vui lòng chụp ít nhất một trang tài liệu.' : 'Please capture at least one page.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const pdf = await PDFDocument.create();

      for (const p of pages) {
        const bytes = new Uint8Array(await p.blob.arrayBuffer());
        const img = await pdf.embedJpg(bytes);

        // Standard A4 portrait (595 x 842 pt)
        const a4Width = 595.28;
        const a4Height = 841.89;
        const page = pdf.addPage([a4Width, a4Height]);

        const scale = Math.min((a4Width - 40) / img.width, (a4Height - 40) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;

        page.drawImage(img, {
          x: (a4Width - w) / 2,
          y: (a4Height - h) / 2,
          width: w,
          height: h
        });
      }

      const out = await pdf.save();
      setResultBytes(out);
    } catch {
      setError(isVi ? 'Lỗi khi tạo tệp PDF từ ảnh quét.' : 'Error generating PDF from scans.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes) return;
    downloadBytes(resultBytes, 'scanned-document.pdf');
  };

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="scan-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'Quét tài liệu bằng Camera (Scan to PDF)' : 'Scan to PDF'}</h1>
          <p>
            {isVi
              ? 'Sử dụng camera máy tính hoặc điện thoại chụp các trang tài liệu, tự động lọc màu đen trắng và xuất file PDF chuẩn A4.'
              : 'Use your device camera to scan paper documents, apply high-contrast filters and export to standard A4 PDF.'}
          </p>
        </div>

        <div className="scan-layout">
          {/* Camera Viewport */}
          <div className="camera-card">
            <div className="camera-viewport">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ display: isCameraActive ? 'block' : 'none' }}
              />
              {!isCameraActive && (
                <div className="camera-idle-state">
                  <Camera size={48} className="idle-icon" />
                  <p>{isVi ? 'Máy ảnh đang tắt' : 'Camera is off'}</p>
                  <button type="button" className="btn btn-primary" onClick={startCamera}>
                    {isVi ? 'Bật Camera quét' : 'Start Camera'}
                  </button>
                </div>
              )}
            </div>

            {cameraError && <div className="error-banner">{cameraError}</div>}

            {isCameraActive && (
              <div className="camera-controls">
                <div className="filter-select">
                  <span className="control-label">{isVi ? 'Bộ lọc màu:' : 'Filter:'}</span>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'color' | 'bw' | 'grayscale')}
                    className="select-input"
                  >
                    <option value="color">{isVi ? 'Màu gốc' : 'Full Color'}</option>
                    <option value="bw">{isVi ? 'Đen trắng tương phản cao' : 'High-Contrast B&W'}</option>
                    <option value="grayscale">{isVi ? 'Ảnh xám (Grayscale)' : 'Grayscale'}</option>
                  </select>
                </div>

                <div className="btn-group">
                  <button type="button" className="btn btn-primary btn-lg" onClick={captureFrame}>
                    <Camera size={20} />
                    {isVi ? 'Chụp trang này' : 'Capture page'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={stopCamera}>
                    {isVi ? 'Tắt Camera' : 'Stop Camera'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Captured Pages List */}
          <div className="gallery-card">
            <div className="gallery-header">
              <h4 className="gallery-title">
                {isVi ? `Các trang đã chụp (${pages.length})` : `Captured pages (${pages.length})`}
              </h4>
              {pages.length > 0 && (
                <button type="button" className="text-btn" onClick={() => setPages([])}>
                  {isVi ? 'Xóa hết' : 'Clear all'}
                </button>
              )}
            </div>

            <div className="scanned-grid">
              {pages.map((p, idx) => (
                <div key={p.id} className="scanned-thumb">
                  <img src={p.dataUrl} alt={`Trang ${idx + 1}`} />
                  <div className="thumb-footer">
                    <span>{isVi ? `Trang ${idx + 1}` : `Page ${idx + 1}`}</span>
                    <button type="button" className="icon-btn" onClick={() => removePage(p.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {pages.length === 0 && (
                <p className="empty-hint">
                  {isVi ? 'Chưa chụp trang nào. Bật camera và bấm "Chụp trang này".' : 'No pages captured yet.'}
                </p>
              )}
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="gallery-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={pages.length === 0 || busy}
                onClick={handleGeneratePdf}
              >
                {busy ? (isVi ? 'Đang tạo PDF…' : 'Generating PDF…') : isVi ? 'Gộp thành tệp PDF' : 'Combine into PDF'}
              </button>

              {resultBytes && (
                <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                  <Download size={18} />
                  {isVi ? 'Tải tệp PDF đã quét' : 'Download Scanned PDF'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
