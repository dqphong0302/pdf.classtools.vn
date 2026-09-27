import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Crop, Download, FileText, RotateCcw, Scissors } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { applyCrop, type CropMarginsMm } from '../lib/pdfPages';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import { openPdfView, type OpenedPdfView } from '../lib/pdfPreview';
import './crop.css';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const DEFAULT_MARGINS: CropMarginsMm = { top: 10, right: 10, bottom: 10, left: 10 };
const MARGIN_KEYS = ['top', 'right', 'bottom', 'left'] as const;

interface SourceDoc {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

interface CropStrings {
  back: string;
  title: string;
  description: string;
  dropLabel: string;
  dropHint: string;
  emptyHint: string;
  pages: (count: number) => string;
  previewLabel: string;
  marginsLabel: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  topAria: string;
  rightAria: string;
  bottomAria: string;
  leftAria: string;
  apply: string;
  applying: string;
  reset: string;
  cropped: (count: number) => string;
  skipped: (count: number) => string;
  download: string;
  opError: string;
  encrypted: string;
  unreadable: string;
  oversized: string;
}

const STRINGS: Record<'vi' | 'en', CropStrings> = {
  vi: {
    back: 'Trang chủ',
    title: 'Cắt mép',
    description:
      'Cắt bớt lề quanh mỗi trang PDF theo khoảng cách tính bằng mm, xem trước ngay trước khi lưu. Mọi thao tác chạy trên thiết bị của bạn.',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    emptyHint: 'Tải lên một tệp PDF để bắt đầu cắt mép.',
    pages: (count) => `${count} trang`,
    previewLabel: 'Xem trước trang 1',
    marginsLabel: 'Lề cắt (mm)',
    top: 'Trên',
    right: 'Phải',
    bottom: 'Dưới',
    left: 'Trái',
    topAria: 'Lề trên (mm)',
    rightAria: 'Lề phải (mm)',
    bottomAria: 'Lề dưới (mm)',
    leftAria: 'Lề trái (mm)',
    apply: 'Cắt mép',
    applying: 'Đang cắt…',
    reset: 'Đặt lại',
    cropped: (count) => `Đã cắt ${count} trang`,
    skipped: (count) => `${count} trang quá nhỏ, bỏ qua`,
    download: 'Tải xuống',
    opError: 'Không thể cắt mép. Tệp có thể bị hỏng hoặc không phải PDF hợp lệ.',
    encrypted: 'Tệp được bảo vệ bằng mật khẩu nên không thể xử lý.',
    unreadable: 'Không đọc được tệp. Tệp có thể bị hỏng hoặc không phải PDF.',
    oversized: 'Bỏ qua tệp quá 100 MB.'
  },
  en: {
    back: 'Home',
    title: 'Crop margins',
    description:
      'Trim the margins of every PDF page by distances in millimetres, with an instant preview. Everything runs on your device.',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    emptyHint: 'Upload a PDF file to start cropping margins.',
    pages: (count) => `${count} pages`,
    previewLabel: 'Page 1 preview',
    marginsLabel: 'Crop margins (mm)',
    top: 'Top',
    right: 'Right',
    bottom: 'Bottom',
    left: 'Left',
    topAria: 'Top margin (mm)',
    rightAria: 'Right margin (mm)',
    bottomAria: 'Bottom margin (mm)',
    leftAria: 'Left margin (mm)',
    apply: 'Crop margins',
    applying: 'Cropping…',
    reset: 'Reset',
    cropped: (count) => `Cropped ${count} pages`,
    skipped: (count) => `${count} pages too small, skipped`,
    download: 'Download',
    opError: 'Could not crop the pages. The file may be corrupted or not a valid PDF.',
    encrypted: 'This file is password protected and cannot be processed.',
    unreadable: 'Could not read the file. It may be corrupted or not a PDF.',
    oversized: 'Skipped files over 100 MB.'
  }
};

function readFileBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });
}

interface CropPreviewProps {
  view: OpenedPdfView | null;
  caption: string;
}

function CropPreview({ view, caption }: CropPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failedView, setFailedView] = useState<OpenedPdfView | null>(null);
  const failed = failedView !== null && failedView === view;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!view || !canvas) return;
    let cancelled = false;
    view.render(1, canvas, 260).catch(() => {
      if (!cancelled) setFailedView(view);
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const info = view?.pages[0];
  const showCanvas = view !== null && !failed && info !== undefined;

  return (
    <div className="crop-preview">
      {showCanvas && info ? (
        <div className="crop-preview__box" style={{ aspectRatio: `${info.width} / ${info.height}` }}>
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>
      ) : (
        <span className="crop-preview__fallback" aria-hidden="true">
          <FileText size={26} />
        </span>
      )}
      <span className="crop-preview__caption">{caption}</span>
    </div>
  );
}

export function CropPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [original, setOriginal] = useState<SourceDoc | null>(null);
  const [source, setSource] = useState<SourceDoc | null>(null);
  const [margins, setMargins] = useState<CropMarginsMm>({ ...DEFAULT_MARGINS });
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; pages: number; skipped: number } | null>(null);
  const [preview, setPreview] = useState<{ bytes: Uint8Array; view: OpenedPdfView } | null>(null);

  const clearOutcome = useCallback(() => {
    setOpError(null);
    setResult(null);
  }, []);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let opened: OpenedPdfView | null = null;
    openPdfView(source.bytes)
      .then((view) => {
        if (cancelled) {
          view.destroy();
          return;
        }
        opened = view;
        setPreview({ bytes: source.bytes, view });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [source]);

  const view = preview && source && preview.bytes === source.bytes ? preview.view : null;

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      clearOutcome();
      setNotice(undefined);
      setPreview(null);
      setMargins({ ...DEFAULT_MARGINS });
      if (file.size > MAX_FILE_BYTES) {
        setOriginal(null);
        setSource(null);
        setNotice(t.oversized);
        return;
      }
      void (async () => {
        try {
          const bytes = new Uint8Array(await readFileBytes(file));
          const pageCount = await getPdfPageCount(bytes);
          const doc: SourceDoc = { file, bytes, pageCount };
          setOriginal(doc);
          setSource(doc);
        } catch (error) {
          setOriginal(null);
          setSource(null);
          setNotice(error instanceof EncryptedPdfError ? t.encrypted : t.unreadable);
        }
      })();
    },
    [clearOutcome, t]
  );

  const updateMargin = useCallback((key: keyof CropMarginsMm, raw: string) => {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    setMargins((prev) => ({ ...prev, [key]: value }));
  }, []);

  const hasMargin = MARGIN_KEYS.some((key) => margins[key] > 0);
  const canCrop = Boolean(source) && !busy && hasMargin;
  const marginsDiverged = MARGIN_KEYS.some((key) => margins[key] !== DEFAULT_MARGINS[key]);
  const canReset = Boolean(source) && !busy && (marginsDiverged || source !== original || result !== null);

  const handleApply = useCallback(async () => {
    if (!source || busy || !hasMargin) return;
    clearOutcome();
    setBusy(true);
    try {
      const cropped = await applyCrop(source.bytes, margins);
      setResult({
        bytes: cropped.bytes,
        pages: cropped.pages - cropped.skippedPages,
        skipped: cropped.skippedPages
      });
      setSource((prev) => (prev ? { ...prev, bytes: cropped.bytes } : prev));
    } catch (error) {
      setOpError(error instanceof EncryptedPdfError ? t.encrypted : t.opError);
    } finally {
      setBusy(false);
    }
  }, [source, busy, hasMargin, margins, clearOutcome, t]);

  const handleReset = useCallback(() => {
    if (!original) return;
    clearOutcome();
    setMargins({ ...DEFAULT_MARGINS });
    setSource(original);
  }, [original, clearOutcome]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const base = source ? source.file.name.replace(/\.pdf$/i, '') : 'pdf';
    downloadBytes(result.bytes, withPdfSuffix(`${base}-${vi ? 'cắt-mép' : 'cropped'}`));
  }, [result, source, vi]);

  const marginFields: Array<{ key: keyof CropMarginsMm; label: string; aria: string }> = [
    { key: 'top', label: t.top, aria: t.topAria },
    { key: 'right', label: t.right, aria: t.rightAria },
    { key: 'bottom', label: t.bottom, aria: t.bottomAria },
    { key: 'left', label: t.left, aria: t.leftAria }
  ];

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="tool-page-heading tool-page-heading--compact">
        <a className="tool-page-heading__back" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> {t.back}
        </a>
        <span className="ct-eyebrow">
          <Crop size={14} aria-hidden="true" /> ClassTools PDF
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </div>

      <div className="pdf-workspace pdf-workspace--two crop-workspace">
        <section className="ct-panel panel-section crop-panel" aria-label={t.dropLabel}>
          <FileDrop label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {source && (
            <div className="crop-source-info">
              <span className="crop-source-name">{fileSummary(source.file)}</span>
              <span className="ct-chip crop-chip">
                <FileText size={13} aria-hidden="true" />
                {t.pages(source.pageCount)}
              </span>
            </div>
          )}

          {source ? <CropPreview view={view} caption={t.previewLabel} /> : <p className="crop-empty">{t.emptyHint}</p>}
        </section>

        <section className="ct-panel panel-section crop-side" aria-label={t.title}>
          <div className="field">
            <span>{t.marginsLabel}</span>
            <div className="crop-margins">
              {marginFields.map(({ key, label, aria }) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={margins[key]}
                    aria-label={aria}
                    onChange={(event) => updateMargin(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="action-bar">
            <button
              className="ct-button ct-button--primary crop-apply"
              type="button"
              disabled={!canCrop}
              onClick={() => void handleApply()}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : <Scissors size={17} aria-hidden="true" />}
              {busy ? t.applying : t.apply}
            </button>
            <button className="ct-button ct-button--soft crop-reset" type="button" disabled={!canReset} onClick={handleReset}>
              <RotateCcw size={16} aria-hidden="true" />
              {t.reset}
            </button>
          </div>

          {opError && (
            <p className="notice" role="alert">
              {opError}
            </p>
          )}

          {result && (
            <div className="crop-result">
              <div className="notice notice--ok crop-result-ok" role="status">
                <span>{t.cropped(result.pages)}</span>
                <button className="ct-button ct-button--accent" type="button" onClick={handleDownload}>
                  <Download size={16} aria-hidden="true" />
                  {t.download}
                </button>
              </div>
              {result.skipped > 0 && (
                <p className="notice" role="alert">
                  {t.skipped(result.skipped)}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </ToolShell>
  );
}
