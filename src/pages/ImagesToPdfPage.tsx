import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, FilePlus2, Trash2 } from 'lucide-react';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, formatBytes, sanitizeFilename, withPdfSuffix } from '../lib/download';
import { getPdfPageCount } from '../lib/pdfOps';
import { imagesToPdf, type ImageOrientation, type ImagePageSize } from '../lib/pdfImages';
import './images-to-pdf.css';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGES = 60;

interface ImageItem {
  id: number;
  file: File;
  bytes: Uint8Array;
  url: string;
}

interface I2pStrings {
  back: string;
  title: string;
  description: string;
  choose: string;
  emptyHint: string;
  images: (count: number) => string;
  tooLarge: (name: string) => string;
  unreadable: (name: string) => string;
  removeImage: (name: string) => string;
  moveUp: (name: string) => string;
  moveDown: (name: string) => string;
  pageSizeLabel: string;
  sizeAuto: string;
  sizeA4: string;
  sizeLetter: string;
  orientationLabel: string;
  orientationAuto: string;
  orientationPortrait: string;
  orientationLandscape: string;
  marginLabel: string;
  create: string;
  working: string;
  resultText: (pages: number) => string;
  outputName: string;
  download: string;
  opError: string;
  needImage: string;
}

const STRINGS: Record<'vi' | 'en', I2pStrings> = {
  vi: {
    back: 'Trang chủ',
    title: 'Ảnh thành PDF',
    description: 'Ghép nhiều ảnh JPG/PNG thành một tệp PDF, sắp thứ tự và chọn khổ giấy ngay trên thiết bị.',
    choose: 'Chọn ảnh (PNG/JPG)',
    emptyHint: 'Chưa có ảnh nào. Hãy chọn ảnh để bắt đầu.',
    images: (count) => `${count} ảnh`,
    tooLarge: (name) => `Bỏ qua ảnh quá 25 MB: ${name}.`,
    unreadable: (name) => `Ảnh không đọc được: ${name}.`,
    removeImage: (name) => `Xóa ảnh ${name}`,
    moveUp: (name) => `Đưa ${name} lên trên`,
    moveDown: (name) => `Đưa ${name} xuống dưới`,
    pageSizeLabel: 'Khổ trang',
    sizeAuto: 'Vừa ảnh',
    sizeA4: 'A4',
    sizeLetter: 'Letter',
    orientationLabel: 'Hướng trang',
    orientationAuto: 'Tự động',
    orientationPortrait: 'Dọc',
    orientationLandscape: 'Ngang',
    marginLabel: 'Lề (mm)',
    create: 'Tạo PDF',
    working: 'Đang xử lý…',
    resultText: (pages) => `Đã tạo PDF ${pages} trang.`,
    outputName: 'Tên tệp',
    download: 'Tải xuống',
    opError: 'Không tạo được PDF từ các ảnh này.',
    needImage: 'Hãy chọn ít nhất một ảnh.'
  },
  en: {
    back: 'Home',
    title: 'Images to PDF',
    description: 'Combine multiple JPG/PNG images into one PDF, reorder them and pick a page size — all on your device.',
    choose: 'Choose images (PNG/JPG)',
    emptyHint: 'No images yet. Choose images to start.',
    images: (count) => `${count} images`,
    tooLarge: (name) => `Skipped image over 25 MB: ${name}.`,
    unreadable: (name) => `Unreadable image: ${name}.`,
    removeImage: (name) => `Remove image ${name}`,
    moveUp: (name) => `Move ${name} up`,
    moveDown: (name) => `Move ${name} down`,
    pageSizeLabel: 'Page size',
    sizeAuto: 'Fit image',
    sizeA4: 'A4',
    sizeLetter: 'Letter',
    orientationLabel: 'Orientation',
    orientationAuto: 'Auto',
    orientationPortrait: 'Portrait',
    orientationLandscape: 'Landscape',
    marginLabel: 'Margin (mm)',
    create: 'Create PDF',
    working: 'Working…',
    resultText: (pages) => `Created a ${pages}-page PDF.`,
    outputName: 'File name',
    download: 'Download',
    opError: 'Could not create a PDF from these images.',
    needImage: 'Choose at least one image.'
  }
};

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

export function ImagesToPdfPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [images, setImages] = useState<ImageItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<ImagePageSize>('a4');
  const [orientation, setOrientation] = useState<ImageOrientation>('auto');
  const [marginMm, setMarginMm] = useState(10);
  const [outputName, setOutputName] = useState('');
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [resultPages, setResultPages] = useState(0);
  const seqRef = useRef(0);

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.url));
    };
    // Cleanup on unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePicked = useCallback(
    (list: FileList | null) => {
      if (!list || !list.length) return;
      setNotice(null);
      setOpError(null);
      const incoming = Array.from(list).slice(0, MAX_IMAGES);
      incoming.forEach((file) => {
        if (file.size > MAX_IMAGE_BYTES) {
          setNotice(t.tooLarge(file.name));
          return;
        }
        void readFileBytes(file)
          .then((buffer) => {
            const bytes = new Uint8Array(buffer);
            if (!bytes.byteLength) {
              setNotice(t.unreadable(file.name));
              return;
            }
            seqRef.current += 1;
            setImages((current) => [
              ...current,
              { id: seqRef.current, file, bytes, url: URL.createObjectURL(file) }
            ]);
          })
          .catch(() => setNotice(t.unreadable(file.name)));
      });
    },
    [t]
  );

  const handleRemove = useCallback((id: number) => {
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((image) => image.id !== id);
    });
    setResult(null);
  }, []);

  const move = useCallback((index: number, delta: -1 | 1) => {
    setImages((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setResult(null);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!images.length) {
      setOpError(t.needImage);
      return;
    }
    setBusy(true);
    setOpError(null);
    setNotice(null);
    setResult(null);
    try {
      const pdfBytes = await imagesToPdf(images.map((image) => image.bytes), {
        pageSize,
        orientation,
        marginMm
      });
      const pageCount = await getPdfPageCount(pdfBytes);
      setResult(pdfBytes);
      setResultPages(pageCount);
    } catch {
      setOpError(t.opError);
    } finally {
      setBusy(false);
    }
  }, [images, pageSize, orientation, marginMm, t]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const name = outputName.trim() || (vi ? 'anh-thanh-pdf' : 'images-to-pdf');
    downloadBytes(result, withPdfSuffix(sanitizeFilename(name)));
  }, [result, outputName, vi]);

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="tool-page-heading tool-page-heading--compact">
        <a className="tool-page-heading__back" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> {t.back}
        </a>
        <span className="ct-eyebrow">
          <FilePlus2 size={14} aria-hidden="true" /> ClassTools PDF
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </div>

      <div className="pdf-workspace pdf-workspace--side i2p-workspace">
        <section className="ct-panel panel-section i2p-source" aria-label={t.title}>
          <label className="field">
            <span>{t.choose}</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              aria-label={t.choose}
              onChange={(event) => {
                handlePicked(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
          {notice && <p className="notice" role="alert">{notice}</p>}

          {images.length ? (
            <ul className="i2p-list">
              {images.map((image, index) => (
                <li key={image.id}>
                  <img src={image.url} alt="" className="i2p-thumb" />
                  <span className="i2p-item__name">{image.file.name}</span>
                  <span className="i2p-item__size">{formatBytes(image.file.size)}</span>
                  <div className="i2p-item__actions">
                    <button
                      className="ct-icon-button"
                      type="button"
                      aria-label={t.moveUp(image.file.name)}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      className="ct-icon-button"
                      type="button"
                      aria-label={t.moveDown(image.file.name)}
                      disabled={index === images.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                    <button
                      className="ct-icon-button"
                      type="button"
                      aria-label={t.removeImage(image.file.name)}
                      onClick={() => handleRemove(image.id)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="thumb-empty">{t.emptyHint}</p>
          )}
          <span className="ct-chip">{t.images(images.length)}</span>
        </section>

        <section className="ct-panel panel-section i2p-main" aria-label={t.title}>
          <div className="i2p-options">
            <div className="field">
              <span>{t.pageSizeLabel}</span>
              <div className="i2p-segmented" role="group" aria-label={t.pageSizeLabel}>
                {([['auto', t.sizeAuto], ['a4', t.sizeA4], ['letter', t.sizeLetter]] as [ImagePageSize, string][]).map(
                  ([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`i2p-seg${pageSize === value ? ' is-active' : ''}`}
                      aria-pressed={pageSize === value}
                      onClick={() => setPageSize(value)}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="field">
              <span>{t.orientationLabel}</span>
              <div className="i2p-segmented" role="group" aria-label={t.orientationLabel}>
                {([['auto', t.orientationAuto], ['portrait', t.orientationPortrait], ['landscape', t.orientationLandscape]] as [
                  ImageOrientation,
                  string
                ][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`i2p-seg${orientation === value ? ' is-active' : ''}`}
                    aria-pressed={orientation === value}
                    onClick={() => setOrientation(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="range-field i2p-margin">
              <span>{t.marginLabel}</span>
              <input type="range" min={0} max={50} value={marginMm} onChange={(event) => setMarginMm(Number(event.target.value))} />
              <output>{marginMm}mm</output>
            </label>
          </div>

          <div className="action-bar">
            <button
              className="ct-button ct-button--primary i2p-create"
              type="button"
              disabled={busy || !images.length}
              onClick={() => void handleCreate()}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : <FilePlus2 size={17} aria-hidden="true" />}
              {busy ? t.working : t.create}
            </button>
            <label className="field i2p-output">
              <span>{t.outputName}</span>
              <input
                type="text"
                aria-label={t.outputName}
                value={outputName}
                placeholder={vi ? 'anh-thanh-pdf' : 'images-to-pdf'}
                onChange={(event) => setOutputName(event.target.value)}
              />
            </label>
          </div>

          {opError && <p className="notice" role="alert">{opError}</p>}

          {result && (
            <div className="notice notice--ok i2p-result" role="status">
              <span>{t.resultText(resultPages)}</span>
              <button className="ct-button ct-button--accent" type="button" onClick={handleDownload}>
                {t.download}
              </button>
            </div>
          )}
        </section>
      </div>
    </ToolShell>
  );
}
