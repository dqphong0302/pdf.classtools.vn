import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, LayoutGrid, ListOrdered, Scissors, SquareSplitHorizontal } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { baseName, downloadBytes, fileSummary, readFileBytes, sanitizeFilename, withPdfSuffix } from '../lib/download';
import { EncryptedPdfError, extractPages, getPdfPageCount, splitEveryN } from '../lib/pdfOps';
import { openPdfView } from '../lib/pdfPreview';
import type { OpenedPdfView } from '../lib/pdfPreview';
import { chunkEvery, formatPageLabel, parsePageRanges } from '../lib/ranges';
import { renderPdfToImages, type PageImageFormat } from '../lib/pdfPageImages';
import { zipFiles } from '../lib/zip';
import './split.css';

type Mode = 'ranges' | 'every' | 'select';

interface SourceDoc {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

interface ExtractResult {
  bytes: Uint8Array;
  pages: number;
  indices: number[];
}

interface SplitPart {
  name: string;
  bytes: Uint8Array;
  pages: number;
}

interface SplitStrings {
  title: string;
  dropLabel: string;
  dropHint: string;
  emptyHint: string;
  pages: (count: number) => string;
  encrypted: string;
  unreadable: (name: string) => string;
  modeLabel: string;
  modeRanges: string;
  modeEvery: string;
  modeSelect: string;
  rangeLabel: string;
  rangePlaceholder: string;
  rangeEmpty: string;
  rangeFormat: string;
  rangeOrder: string;
  rangeBounds: (count: number) => string;
  selectedLabel: (label: string) => string;
  extractAction: string;
  everyLabel: string;
  everyPreview: (count: number) => string;
  splitAction: string;
  previewLoading: string;
  selectedCount: (count: number) => string;
  pageLabel: (page: number) => string;
  extractSelectedAction: string;
  working: string;
  outputLabel: string;
  outputAria: string;
  resultText: (count: number) => string;
  multiResultText: (count: number) => string;
  download: string;
  zipAll: string;
  saveAs: string;
  formatPdf: string;
  formatPng: string;
  formatJpg: string;
  imagesHint: string;
  opError: string;
}

const STRINGS: Record<'vi' | 'en', SplitStrings> = {
  vi: {
    title: 'Tách / Trích trang',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    emptyHint: 'Tải lên một tệp PDF để bắt đầu tách trang.',
    pages: (count) => `${count} trang`,
    encrypted: 'Tệp được bảo vệ bằng mật khẩu. Hãy mở khóa trước khi tách.',
    unreadable: (name) => `Không đọc được tệp: ${name}. Tệp có thể bị hỏng hoặc không phải PDF.`,
    modeLabel: 'Chế độ tách',
    modeRanges: 'Khoảng trang',
    modeEvery: 'Mỗi N trang',
    modeSelect: 'Chọn trên xem trước',
    rangeLabel: 'Khoảng trang cần trích',
    rangePlaceholder: 'VD: 1-3, 5, 8-',
    rangeEmpty: 'Nhập khoảng trang, ví dụ 1-3, 5.',
    rangeFormat: 'Khoảng trang không đúng định dạng. Ví dụ hợp lệ: 1-3, 5, 8-.',
    rangeOrder: 'Khoảng trang bị ngược (vd 5-2). Hãy viết theo thứ tự tăng dần.',
    rangeBounds: (count) => `Số trang nằm ngoài phạm vi: tệp chỉ có ${count} trang.`,
    selectedLabel: (label) => `Đã chọn: ${label}`,
    extractAction: 'Trích xuất',
    everyLabel: 'Số trang mỗi phần',
    everyPreview: (count) => `Tách thành ${count} phần`,
    splitAction: 'Tách',
    previewLoading: 'Đang tạo bản xem trước…',
    selectedCount: (count) => `Đã chọn: ${count} trang`,
    pageLabel: (page) => `Trang ${page}`,
    extractSelectedAction: 'Trích trang đã chọn',
    working: 'Đang xử lý…',
    outputLabel: 'Tên tệp kết quả',
    outputAria: 'Tên tệp kết quả',
    resultText: (count) => `Đã trích ${count} trang thành một tệp mới.`,
    multiResultText: (count) => `Đã tách thành ${count} tệp.`,
    download: 'Tải xuống',
    zipAll: 'Tải tất cả (ZIP)',
    saveAs: 'Lưu thành',
    formatPdf: 'Tệp PDF',
    formatPng: 'Ảnh PNG',
    formatJpg: 'Ảnh JPG',
    imagesHint: 'Mỗi trang là một ảnh; nhiều trang sẽ được nén trong một tệp ZIP.',
    opError: 'Không thể xử lý tệp PDF này. Tệp có thể bị hỏng hoặc không đúng chuẩn.'
  },
  en: {
    title: 'Split & Extract',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    emptyHint: 'Upload a PDF file to start splitting pages.',
    pages: (count) => `${count} pages`,
    encrypted: 'This file is password protected. Unlock it before splitting.',
    unreadable: (name) => `Could not read file: ${name}. It may be corrupted or not a PDF.`,
    modeLabel: 'Split mode',
    modeRanges: 'Page ranges',
    modeEvery: 'Every N pages',
    modeSelect: 'Pick on preview',
    rangeLabel: 'Page ranges to extract',
    rangePlaceholder: 'E.g. 1-3, 5, 8-',
    rangeEmpty: 'Enter page ranges first, e.g. 1-3, 5.',
    rangeFormat: 'Invalid page range format. Valid example: 1-3, 5, 8-.',
    rangeOrder: 'Range is reversed (e.g. 5-2). Write ranges in ascending order.',
    rangeBounds: (count) => `Page number is out of range: the file only has ${count} pages.`,
    selectedLabel: (label) => `Selected: ${label}`,
    extractAction: 'Extract',
    everyLabel: 'Pages per part',
    everyPreview: (count) => `Split into ${count} parts`,
    splitAction: 'Split',
    previewLoading: 'Building the preview…',
    selectedCount: (count) => `Selected: ${count} pages`,
    pageLabel: (page) => `Page ${page}`,
    extractSelectedAction: 'Extract selected pages',
    working: 'Working…',
    outputLabel: 'Output file name',
    outputAria: 'Output file name',
    resultText: (count) => `Extracted ${count} pages into a new file.`,
    multiResultText: (count) => `Split into ${count} files.`,
    download: 'Download',
    zipAll: 'Download all (ZIP)',
    saveAs: 'Save as',
    formatPdf: 'PDF file',
    formatPng: 'PNG images',
    formatJpg: 'JPG images',
    imagesHint: 'One image per page; several pages are packed into one ZIP file.',
    opError: 'Could not process this PDF. The file may be corrupted or not a valid PDF.'
  }
};

function rangeErrorMessage(error: string | null, pageCount: number, t: SplitStrings): string {
  if (error === 'format') return t.rangeFormat;
  if (error === 'order') return t.rangeOrder;
  if (error === 'bounds') return t.rangeBounds(pageCount);
  return t.rangeEmpty;
}

interface PageThumbProps {
  view: OpenedPdfView | null;
  pageNumber: number;
  label: string;
  selected: boolean;
  onToggle: () => void;
}

function PageThumb({ view, pageNumber, label, selected, onToggle }: PageThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!view || !canvas) return;
    let cancelled = false;
    view.render(pageNumber, canvas, 150).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [view, pageNumber]);

  const showCanvas = view !== null && !failed;

  return (
    <button
      type="button"
      className={`thumb-card${selected ? ' thumb-card--selected' : ''}`}
      aria-pressed={selected}
      aria-label={label}
      onClick={onToggle}
    >
      <span className="thumb-card__badge">{pageNumber}</span>
      {showCanvas ? <canvas ref={canvasRef} /> : <span className="split-thumb-fallback">{label}</span>}
    </button>
  );
}

export function SplitPage() {
  const { locale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [source, setSource] = useState<SourceDoc | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<Mode>('ranges');
  const [rangeInput, setRangeInput] = useState('');
  const [everyN, setEveryN] = useState('2');
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [view, setView] = useState<OpenedPdfView | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [single, setSingle] = useState<ExtractResult | null>(null);
  const [parts, setParts] = useState<SplitPart[] | null>(null);
  const [saveFormat, setSaveFormat] = useState<'pdf' | PageImageFormat>('pdf');
  const [saving, setSaving] = useState(false);

  const clearOutcome = useCallback(() => {
    setOpError(null);
    setSingle(null);
    setParts(null);
  }, []);

  const parsed = useMemo(() => {
    if (!source || !rangeInput.trim()) return null;
    return parsePageRanges(rangeInput, source.pageCount);
  }, [rangeInput, source]);

  const n = Math.min(50, Math.max(1, Math.floor(Number(everyN) || 1)));
  const allIndices = useMemo(
    () => (source ? Array.from({ length: source.pageCount }, (_, index) => index) : []),
    [source]
  );
  const partCount = chunkEvery(allIndices, n).length;
  const pageNumbers = allIndices.map((index) => index + 1);

  useEffect(() => {
    if (!source || mode !== 'select') return;
    let cancelled = false;
    let opened: OpenedPdfView | null = null;
    openPdfView(source.bytes)
      .then((openedView) => {
        if (cancelled) {
          openedView.destroy();
          return;
        }
        opened = openedView;
        setView(openedView);
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true);
      });
    return () => {
      cancelled = true;
      opened?.destroy();
      setView(null);
    };
  }, [source, mode]);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      clearOutcome();
      setNotice(undefined);
      setView(null);
      setPreviewFailed(false);
      setSelected(new Set());
      setRangeInput('');
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
    [clearOutcome, t]
  );

  const runExtract = useCallback(
    async (indices: number[]) => {
      if (!source) return;
      clearOutcome();
      setBusy(true);
      try {
        const bytes = await extractPages(source.bytes, indices);
        setSingle({ bytes, pages: indices.length, indices });
      } catch {
        setOpError(t.opError);
      } finally {
        setBusy(false);
      }
    },
    [source, clearOutcome, t]
  );

  const handleExtractRanges = useCallback(() => {
    if (!parsed || parsed.error || !parsed.indices.length) return;
    void runExtract(parsed.indices);
  }, [parsed, runExtract]);

  const handleSplit = useCallback(async () => {
    if (!source) return;
    clearOutcome();
    setBusy(true);
    try {
      const outputs = await splitEveryN(source.bytes, n);
      const chunks = chunkEvery(allIndices, n);
      setParts(
        outputs.map((output, index) => ({
          name: output.name,
          bytes: output.bytes,
          pages: chunks[index]?.length ?? 0
        }))
      );
    } catch {
      setOpError(t.opError);
    } finally {
      setBusy(false);
    }
  }, [source, n, allIndices, clearOutcome, t]);

  const handleExtractSelected = useCallback(() => {
    if (!selected.size) return;
    void runExtract([...selected].sort((a, b) => a - b));
  }, [selected, runExtract]);

  const togglePage = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const singleDefaultName =
    single && source
      ? `${baseName(source.file.name)}-${vi ? 'trang' : 'pages'}-${formatPageLabel(
          single.indices
        ).replace(/,\s*/g, '-')}`
      : '';
  const singleName = singleDefaultName;

  const handleDownloadSingle = useCallback(async () => {
    if (!single) return;
    if (saveFormat === 'pdf') {
      downloadBytes(single.bytes, withPdfSuffix(singleName));
      return;
    }
    setSaving(true);
    setOpError(null);
    try {
      const images = await renderPdfToImages(single.bytes, saveFormat);
      const mime = saveFormat === 'jpg' ? 'image/jpeg' : 'image/png';
      const base = sanitizeFilename(singleName.replace(/\.(pdf|zip|png|jpe?g)$/i, '')) || 'pages';
      if (images.length === 1) {
        downloadBytes(images[0].bytes, `${base}.${saveFormat}`, mime);
        return;
      }
      const zipBytes = await zipFiles(
        images.map((image, index) => ({
          name: `${base}-${single.indices[index] + 1}.${saveFormat}`,
          bytes: image.bytes
        }))
      );
      downloadBytes(zipBytes, `${base}.zip`, 'application/zip');
    } catch {
      setOpError(t.opError);
    } finally {
      setSaving(false);
    }
  }, [single, singleName, saveFormat, t]);

  const handleDownloadZip = useCallback(async () => {
    if (!parts || !parts.length) return;
    setZipBusy(true);
    try {
      const zipBytes = await zipFiles(parts.map((part) => ({ name: part.name, bytes: part.bytes })));
      const base = source ? baseName(source.file.name) : 'split';
      const name = sanitizeFilename(base + '-parts') + '.zip';
      downloadBytes(zipBytes, name, 'application/zip');
    } catch {
      setOpError(t.opError);
    } finally {
      setZipBusy(false);
    }
  }, [parts, source, t]);

  const modeTabs: Array<{ id: Mode; label: string; icon: typeof Scissors }> = [
    { id: 'ranges', label: t.modeRanges, icon: ListOrdered },
    { id: 'every', label: t.modeEvery, icon: SquareSplitHorizontal },
    { id: 'select', label: t.modeSelect, icon: LayoutGrid }
  ];

  return (
    <ToolShell>

      <div className="pdf-workspace pdf-workspace--side split-workspace">
        <section className="ct-panel panel-section split-source" aria-label={t.dropLabel}>
          <FileDrop compact={source !== null} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {source && (
            <div className="split-source__info">
              <span className="split-source__name">{fileSummary(source.file)}</span>
              <span className="ct-chip split-chip">
                <FileText size={13} aria-hidden="true" />
                {t.pages(source.pageCount)}
              </span>
            </div>
          )}
        </section>

        <section className="ct-panel panel-section split-main" aria-label={t.title}>
          {source ? (
            <>
              <div className="split-tabs" role="group" aria-label={t.modeLabel}>
                {modeTabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`split-tab${mode === id ? ' is-active' : ''}`}
                    aria-pressed={mode === id}
                    onClick={() => {
                      setMode(id);
                      setOpError(null);
                      setView(null);
                      setPreviewFailed(false);
                    }}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'ranges' && (
                <div className="split-mode-body">
                  <label className="field">
                    <span>{t.rangeLabel}</span>
                    <input
                      type="text"
                      value={rangeInput}
                      aria-label={t.rangeLabel}
                      placeholder={t.rangePlaceholder}
                      onChange={(event) => setRangeInput(event.target.value)}
                    />
                  </label>
                  {rangeInput.trim() && parsed?.error && (
                    <p className="notice" role="alert">
                      {rangeErrorMessage(parsed.error, source.pageCount, t)}
                    </p>
                  )}
                  {rangeInput.trim() && parsed && !parsed.error && (
                    <span className="ct-chip split-chip">
                      <ListOrdered size={13} aria-hidden="true" />
                      {t.selectedLabel(formatPageLabel(parsed.indices))}
                    </span>
                  )}
                  <div className="action-bar">
                    <button
                      type="button"
                      className="ct-button ct-button--primary split-action"
                      disabled={!parsed || Boolean(parsed.error) || !parsed?.indices.length || busy}
                      onClick={handleExtractRanges}
                    >
                      {busy ? <span className="spinner" aria-hidden="true" /> : <Scissors size={17} aria-hidden="true" />}
                      {busy ? t.working : t.extractAction}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'every' && (
                <div className="split-mode-body">
                  <label className="field">
                    <span>{t.everyLabel}</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={everyN}
                      aria-label={t.everyLabel}
                      onChange={(event) => setEveryN(event.target.value)}
                    />
                  </label>
                  <span className="ct-chip split-chip">
                    <SquareSplitHorizontal size={13} aria-hidden="true" />
                    {t.everyPreview(partCount)}
                  </span>
                  <div className="action-bar">
                    <button
                      type="button"
                      className="ct-button ct-button--primary split-action"
                      disabled={busy}
                      onClick={() => void handleSplit()}
                    >
                      {busy ? <span className="spinner" aria-hidden="true" /> : <Scissors size={17} aria-hidden="true" />}
                      {busy ? t.working : t.splitAction}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'select' && (
                <div className="split-mode-body">
                  <div className="split-select-head">
                    {!view && !previewFailed && (
                      <p className="split-loading">
                        <span className="spinner" aria-hidden="true" /> {t.previewLoading}
                      </p>
                    )}
                    <span className="ct-chip split-chip">{t.selectedCount(selected.size)}</span>
                  </div>
                  <div className="thumb-grid split-thumb-grid">
                    {pageNumbers.map((pageNumber) => (
                      <PageThumb
                        key={pageNumber}
                        view={view}
                        pageNumber={pageNumber}
                        label={t.pageLabel(pageNumber)}
                        selected={selected.has(pageNumber - 1)}
                        onToggle={() => togglePage(pageNumber - 1)}
                      />
                    ))}
                  </div>
                  <div className="action-bar">
                    <button
                      type="button"
                      className="ct-button ct-button--primary split-action"
                      disabled={!selected.size || busy}
                      onClick={handleExtractSelected}
                    >
                      {busy ? <span className="spinner" aria-hidden="true" /> : <Scissors size={17} aria-hidden="true" />}
                      {busy ? t.working : t.extractSelectedAction}
                    </button>
                  </div>
                </div>
              )}

              {opError && (
                <p className="notice" role="alert">
                  {opError}
                </p>
              )}

              {single && (
                <div className="split-result notice notice--ok" role="status">
                  <span>{t.resultText(single.pages)}</span>
                  <div className="field split-format" role="group" aria-label={t.saveAs}>
                    <span>{t.saveAs}</span>
                    <div className="split-format__options">
                      {(
                        [
                          ['pdf', t.formatPdf],
                          ['png', t.formatPng],
                          ['jpg', t.formatJpg]
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`split-tab${saveFormat === id ? ' is-active' : ''}`}
                          aria-pressed={saveFormat === id}
                          onClick={() => setSaveFormat(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {saveFormat !== 'pdf' && <small>{t.imagesHint}</small>}
                  </div>
                  <div className="action-bar">
                    <button
                      type="button"
                      className="ct-button ct-button--accent"
                      disabled={saving}
                      onClick={() => void handleDownloadSingle()}
                    >
                      {saving ? <span className="spinner" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
                      {saving ? t.working : t.download}
                    </button>
                  </div>
                </div>
              )}

              {parts && parts.length > 0 && (
                <div className="split-result notice notice--ok" role="status">
                  <span>{t.multiResultText(parts.length)}</span>
                  {parts.length > 1 && (
                    <div className="action-bar split-zip-bar">
                      <button
                        type="button"
                        className="ct-button ct-button--accent split-zip-download"
                        disabled={zipBusy}
                        onClick={() => void handleDownloadZip()}
                      >
                        {zipBusy ? (
                          <span className="spinner" aria-hidden="true" />
                        ) : (
                          <Download size={16} aria-hidden="true" />
                        )}
                        {zipBusy ? t.working : t.zipAll}
                      </button>
                    </div>
                  )}
                  <ul className="file-list split-parts">
                    {parts.map((part) => (
                      <li key={part.name}>
                        <span className="file-list__name">{part.name}</span>
                        <span className="ct-chip split-chip">{t.pages(part.pages)}</span>
                        <button
                          type="button"
                          className="ct-button ct-button--soft split-part-download"
                          onClick={() => downloadBytes(part.bytes, withPdfSuffix(part.name))}
                        >
                          <Download size={15} aria-hidden="true" />
                          {t.download}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="thumb-empty">{t.emptyHint}</p>
          )}
        </section>
      </div>
    </ToolShell>
  );
}
