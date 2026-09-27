import { useCallback, useRef, useState } from 'react';
import { ArrowLeft, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, formatBytes, sanitizeFilename } from '../lib/download';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import { openPdfView } from '../lib/pdfPreview';
import type { OpenedPdfView } from '../lib/pdfPreview';
import { zipFiles } from '../lib/zip';
import './pdf-to-images.css';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const RESOLUTIONS = [720, 1080, 1440] as const;
type OutputFormat = 'jpg' | 'png';

interface SourceDoc {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

interface RenderedImage {
  pageNumber: number;
  name: string;
  bytes: Uint8Array;
  url: string;
}

interface P2iStrings {
  back: string;
  title: string;
  description: string;
  dropLabel: string;
  dropHint: string;
  emptyHint: string;
  pages: (count: number) => string;
  oversized: (name: string) => string;
  encrypted: string;
  unreadable: (name: string) => string;
  formatLabel: string;
  qualityLabel: string;
  resolutionLabel: string;
  convert: string;
  working: string;
  converting: (done: number, total: number) => string;
  results: (count: number) => string;
  downloadAll: string;
  downloadOne: (name: string) => string;
  zipping: string;
  emptyResult: string;
  opError: string;
  fileSize: string;
}

const STRINGS: Record<'vi' | 'en', P2iStrings> = {
  vi: {
    back: 'Trang chủ',
    title: 'PDF thành ảnh',
    description: 'Chuyển từng trang PDF thành ảnh JPG hoặc PNG ngay trên thiết bị, tải riêng lẻ hoặc gộp ZIP.',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    emptyHint: 'Tải lên một tệp PDF để bắt đầu chuyển đổi.',
    pages: (count) => `${count} trang`,
    oversized: (name) => `Bỏ qua tệp quá 100 MB: ${name}.`,
    encrypted: 'Tệp được bảo vệ bằng mật khẩu. Hãy mở khóa trước khi chuyển đổi.',
    unreadable: (name) => `Không đọc được tệp: ${name}. Tệp có thể bị hỏng hoặc không phải PDF.`,
    formatLabel: 'Định dạng ảnh',
    qualityLabel: 'Chất lượng JPG',
    resolutionLabel: 'Độ rộng ảnh (px)',
    convert: 'Chuyển đổi',
    working: 'Đang xử lý…',
    converting: (done, total) => `Đang chuyển ${done}/${total}…`,
    results: (count) => `${count} ảnh đã tạo`,
    downloadAll: 'Tải tất cả (ZIP)',
    downloadOne: (name) => `Tải ${name}`,
    zipping: 'Đang đóng gói…',
    emptyResult: 'Chưa có ảnh nào. Hãy bấm Chuyển đổi.',
    opError: 'Không thể chuyển đổi tệp PDF này. Tệp có thể bị hỏng hoặc không đúng chuẩn.',
    fileSize: 'Dung lượng'
  },
  en: {
    back: 'Home',
    title: 'PDF to images',
    description: 'Turn each PDF page into a JPG or PNG image on your device, download individually or as a ZIP.',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    emptyHint: 'Upload a PDF file to start converting.',
    pages: (count) => `${count} pages`,
    oversized: (name) => `Skipped file over 100 MB: ${name}.`,
    encrypted: 'This file is password protected. Unlock it before converting.',
    unreadable: (name) => `Could not read file: ${name}. It may be corrupted or not a PDF.`,
    formatLabel: 'Image format',
    qualityLabel: 'JPG quality',
    resolutionLabel: 'Image width (px)',
    convert: 'Convert',
    working: 'Working…',
    converting: (done, total) => `Converting ${done}/${total}…`,
    results: (count) => `${count} images created`,
    downloadAll: 'Download all (ZIP)',
    downloadOne: (name) => `Download ${name}`,
    zipping: 'Packaging…',
    emptyResult: 'No images yet. Press Convert.',
    opError: 'Could not convert this PDF. The file may be corrupted or not a valid PDF.',
    fileSize: 'Size'
  }
};

function canvasToBytes(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('BLOB_FAILED'));
          return;
        }
        if (typeof blob.arrayBuffer === 'function') {
          blob
            .arrayBuffer()
            .then((buffer) => resolve(new Uint8Array(buffer)))
            .catch(() => reject(new Error('BLOB_READ_FAILED')));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(new Error('BLOB_READ_FAILED'));
        reader.readAsArrayBuffer(blob);
      },
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality
    );
  });
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });
}

export function PdfToImagesPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const t = STRINGS[locale];

  const [source, setSource] = useState<SourceDoc | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [format, setFormat] = useState<OutputFormat>('png');
  const [quality, setQuality] = useState(80);
  const [width, setWidth] = useState<number>(1080);
  const [images, setImages] = useState<RenderedImage[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const viewRef = useRef<OpenedPdfView | null>(null);

  const releaseImages = useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
  }, []);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      setNotice(undefined);
      setOpError(null);
      releaseImages();
      setProgress(null);
      if (file.size > MAX_FILE_BYTES) {
        setSource(null);
        setNotice(t.oversized(file.name));
        return;
      }
      void (async () => {
        try {
          const bytes = new Uint8Array(await readFileBytes(file));
          const pageCount = await getPdfPageCount(bytes);
          setSource({ file, bytes, pageCount });
        } catch (error) {
          setSource(null);
          setNotice(error instanceof EncryptedPdfError ? t.encrypted : t.unreadable(file.name));
        }
      })();
    },
    [t, releaseImages]
  );

  const handleConvert = useCallback(async () => {
    if (!source) return;
    setBusy(true);
    setOpError(null);
    releaseImages();
    try {
      const opened = await openPdfView(source.bytes);
      viewRef.current = opened;
      const created: RenderedImage[] = [];
      for (let pageNumber = 1; pageNumber <= opened.pageCount; pageNumber += 1) {
        setProgress({ done: pageNumber - 1, total: opened.pageCount });
        const canvas = document.createElement('canvas');
        await opened.render(pageNumber, canvas, width);
        const bytes = await canvasToBytes(canvas, format, quality / 100);
        const blob = new Blob([new Uint8Array(bytes)], { type: format === 'jpg' ? 'image/jpeg' : 'image/png' });
        created.push({
          pageNumber,
          name: `page-${pageNumber}.${format}`,
          bytes,
          url: URL.createObjectURL(blob)
        });
      }
      setProgress({ done: opened.pageCount, total: opened.pageCount });
      setImages(created);
    } catch {
      setOpError(t.opError);
      releaseImages();
    } finally {
      setBusy(false);
      viewRef.current?.destroy();
      viewRef.current = null;
    }
  }, [source, format, quality, width, releaseImages, t]);

  const handleDownloadAll = useCallback(async () => {
    if (!images.length || !source) return;
    setZipBusy(true);
    try {
      const zipBytes = await zipFiles(images.map((image) => ({ name: image.name, bytes: image.bytes })));
      const base = source.file.name.replace(/\.pdf$/i, '');
      downloadBytes(zipBytes, `${sanitizeFilename(base)}-images.zip`, 'application/zip');
    } catch {
      setOpError(t.opError);
    } finally {
      setZipBusy(false);
    }
  }, [images, source, t]);

  const sizeLabel = (bytes: Uint8Array) => formatBytes(bytes.byteLength);

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="tool-page-heading tool-page-heading--compact">
        <a className="tool-page-heading__back" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> {t.back}
        </a>
        <span className="ct-eyebrow">
          <ImageIcon size={14} aria-hidden="true" /> ClassTools PDF
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </div>

      <div className="pdf-workspace pdf-workspace--side p2i-workspace">
        <section className="ct-panel panel-section p2i-source" aria-label={t.dropLabel}>
          <FileDrop label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {source && (
            <div className="p2i-source__info">
              <span className="p2i-source__name">{fileSummary(source.file)}</span>
              <span className="ct-chip">
                <FileText size={13} aria-hidden="true" />
                {t.pages(source.pageCount)}
              </span>
            </div>
          )}
        </section>

        <section className="ct-panel panel-section p2i-main" aria-label={t.title}>
          {source ? (
            <>
              <div className="p2i-controls">
                <div className="p2i-segmented" role="group" aria-label={t.formatLabel}>
                  {(['png', 'jpg'] as OutputFormat[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`p2i-seg${format === value ? ' is-active' : ''}`}
                      aria-pressed={format === value}
                      onClick={() => setFormat(value)}
                    >
                      {value.toUpperCase()}
                    </button>
                  ))}
                </div>
                {format === 'jpg' && (
                  <label className="range-field p2i-quality">
                    <span>{t.qualityLabel}</span>
                    <input type="range" min={50} max={100} value={quality} onChange={(event) => setQuality(Number(event.target.value))} />
                    <output>{quality}%</output>
                  </label>
                )}
                <label className="field p2i-resolution">
                  <span>{t.resolutionLabel}</span>
                  <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
                    {RESOLUTIONS.map((value) => (
                      <option key={value} value={value}>{value}px</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="action-bar">
                <button
                  className="ct-button ct-button--primary p2i-convert"
                  type="button"
                  disabled={busy}
                  onClick={() => void handleConvert()}
                >
                  {busy ? <span className="spinner" aria-hidden="true" /> : <ImageIcon size={17} aria-hidden="true" />}
                  {busy ? (progress ? t.converting(progress.done, progress.total) : t.working) : t.convert}
                </button>
              </div>

              {opError && <p className="notice" role="alert">{opError}</p>}

              <div className="p2i-results">
                <div className="p2i-results__head">
                  <span className="ct-chip">{t.results(images.length)}</span>
                  {images.length > 1 && (
                    <button
                      className="ct-button ct-button--accent"
                      type="button"
                      disabled={zipBusy}
                      onClick={() => void handleDownloadAll()}
                    >
                      {zipBusy ? <span className="spinner" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                      {zipBusy ? t.zipping : t.downloadAll}
                    </button>
                  )}
                </div>
                {images.length ? (
                  <ul className="p2i-grid">
                    {images.map((image) => (
                      <li key={image.pageNumber} className="p2i-item">
                        <img src={image.url} alt={image.name} className="p2i-thumb" />
                        <span className="p2i-item__name">{image.name}</span>
                        <span className="p2i-item__size">{sizeLabel(image.bytes)}</span>
                        <button
                          className="ct-icon-button"
                          type="button"
                          aria-label={t.downloadOne(image.name)}
                          onClick={() => downloadBytes(image.bytes, image.name)}
                        >
                          <Download size={15} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="thumb-empty">{t.emptyResult}</p>
                )}
              </div>
            </>
          ) : (
            <p className="thumb-empty">{t.emptyHint}</p>
          )}
        </section>
      </div>
    </ToolShell>
  );
}
