import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, FileText, Image as ImageIcon, Stamp, Type } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { openPdfView, type OpenedPdfView } from '../lib/pdfPreview';
import { addWatermark, type WatermarkOptions } from '../lib/pdfWatermark';
import './watermark.css';

interface DocState {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export function WatermarkPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const [doc, setDoc] = useState<DocState | null>(null);

  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('BẢN SAO / COPY');
  const [angle, setAngle] = useState(45);
  const [opacity, setOpacity] = useState(0.25);
  const [fontSize, setFontSize] = useState(42);
  const [colorHex, setColorHex] = useState('#dc2626');
  const [tiled, setTiled] = useState(false);

  // Image watermark state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);
  const [imgScale, setImgScale] = useState(0.5);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setImageBytes(bytes);
  };

  useEffect(() => {
    if (!doc || !previewRef.current || !canvasRef.current) return;
    previewRef.current.render(1, canvasRef.current, 280).catch(() => {});
  }, [doc]);

  const handleApply = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      let opt: WatermarkOptions;
      if (mode === 'text') {
        opt = {
          type: 'text',
          text: text.trim() || 'WATERMARK',
          angle,
          opacity,
          fontSize,
          colorHex,
          tiled
        };
      } else {
        if (!imageBytes || !imageFile) {
          setError(isVi ? 'Vui lòng chọn ảnh logo mờ.' : 'Please select a watermark image.');
          setBusy(false);
          return;
        }
        opt = {
          type: 'image',
          imageBytes,
          isPng: imageFile.type.includes('png') || imageFile.name.endsWith('.png'),
          angle,
          opacity,
          scale: imgScale,
          tiled
        };
      }

      const res = await addWatermark(doc.bytes, opt);
      setResultBytes(res);
    } catch {
      setError(isVi ? 'Lỗi khi đóng dấu bản quyền.' : 'Error applying watermark.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !doc) return;
    downloadBytes(resultBytes, withPdfSuffix(doc.file.name.replace(/\.pdf$/i, '') + '-watermarked'));
  };

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="watermark-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'Đóng dấu bản quyền (Watermark)' : 'Add Watermark'}</h1>
          <p>
            {isVi
              ? 'Đóng dấu văn bản hoặc chèn logo mờ vào tài liệu PDF, tùy chỉnh góc nghiêng 45°, độ trong suốt và lặp lại.'
              : 'Stamp text or image watermarks onto PDF pages with custom angles, transparency and tiling.'}
          </p>
        </div>

        {!doc ? (
          <FileDrop
            onFiles={(files) => files[0] && handleFile(files[0])}
            label={isVi ? 'Chọn hoặc kéo thả tệp PDF cần đóng dấu' : 'Choose or drop a PDF to watermark'}
            hint={isVi ? 'Một tệp PDF duy nhất' : 'A single PDF file'}
          />
        ) : (
          <div className="wm-workspace">
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

            <div className="wm-layout">
              {/* Settings panel */}
              <div className="wm-settings-card">
                <div className="tab-switcher">
                  <button
                    type="button"
                    className={`tab-btn ${mode === 'text' ? 'active' : ''}`}
                    onClick={() => setMode('text')}
                  >
                    <Type size={16} />
                    {isVi ? 'Dấu chữ (Text)' : 'Text Watermark'}
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${mode === 'image' ? 'active' : ''}`}
                    onClick={() => setMode('image')}
                  >
                    <ImageIcon size={16} />
                    {isVi ? 'Dấu ảnh / Logo' : 'Image Watermark'}
                  </button>
                </div>

                {mode === 'text' ? (
                  <>
                    <div className="field-group">
                      <label className="field-label">{isVi ? 'Nội dung dấu mờ' : 'Watermark text'}</label>
                      <input
                        type="text"
                        className="text-input"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="CONFIDENTIAL, BẢN SAO..."
                      />
                    </div>

                    <div className="quick-presets">
                      {['BẢN SAO', 'CONFIDENTIAL', 'DRAFT', 'MẬT', 'KHÔNG CHIA SẺ'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="chip"
                          onClick={() => setText(preset)}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <div className="field-row">
                      <div className="field-group">
                        <label className="field-label">{isVi ? 'Cỡ chữ' : 'Font size'}</label>
                        <input
                          type="number"
                          className="text-input"
                          min={16}
                          max={90}
                          value={fontSize}
                          onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 40)}
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">{isVi ? 'Màu sắc' : 'Color'}</label>
                        <input
                          type="color"
                          className="color-input"
                          value={colorHex}
                          onChange={(e) => setColorHex(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="field-group">
                    <label className="field-label">{isVi ? 'Tải ảnh Logo (PNG / JPG)' : 'Upload Logo image'}</label>
                    <input type="file" accept="image/png,image/jpeg" onChange={handleImageUpload} />
                    {imageFile && (
                      <p className="file-meta" style={{ marginTop: '0.25rem' }}>
                        {imageFile.name}
                      </p>
                    )}
                    <label className="field-label" style={{ marginTop: '0.5rem' }}>
                      {isVi ? `Tỉ lệ phóng to (${Math.round(imgScale * 100)}%)` : `Scale (${Math.round(imgScale * 100)}%)`}
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={1.5}
                      step={0.05}
                      value={imgScale}
                      onChange={(e) => setImgScale(parseFloat(e.target.value))}
                    />
                  </div>
                )}

                <div className="field-row" style={{ marginTop: '0.75rem' }}>
                  <div className="field-group">
                    <label className="field-label">{isVi ? `Góc xoay (${angle}°)` : `Angle (${angle}°)`}</label>
                    <input
                      type="range"
                      min={-90}
                      max={90}
                      step={15}
                      value={angle}
                      onChange={(e) => setAngle(parseInt(e.target.value, 10))}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">
                      {isVi ? `Độ mờ (${Math.round(opacity * 100)}%)` : `Opacity (${Math.round(opacity * 100)}%)`}
                    </label>
                    <input
                      type="range"
                      min={0.05}
                      max={0.9}
                      step={0.05}
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={tiled}
                      onChange={(e) => setTiled(e.target.checked)}
                    />
                    {isVi ? 'Lặp lại toàn bộ trang (Tiled / Mosaic)' : 'Repeat across page (Mosaic)'}
                  </label>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="actions" style={{ marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={handleApply}>
                    <Stamp size={18} />
                    {busy ? (isVi ? 'Đang đóng dấu…' : 'Applying…') : isVi ? 'Đóng dấu và lưu PDF' : 'Stamp & Save'}
                  </button>
                  {resultBytes && (
                    <button type="button" className="btn btn-success btn-lg" onClick={handleDownload}>
                      <Download size={18} />
                      {isVi ? 'Tải tệp đã đóng dấu' : 'Download stamped PDF'}
                    </button>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="wm-preview-card">
                <span className="preview-label">{isVi ? 'Xem trước trang 1' : 'Page 1 Preview'}</span>
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
