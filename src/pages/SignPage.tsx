import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Download, Eraser, FileSignature, FileText, PenLine, Trash2, Type } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { baseName, downloadBytes, fileSummary, readFileBytes, withPdfSuffix } from '../lib/download';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import { openPdfView } from '../lib/pdfPreview';
import type { OpenedPdfView } from '../lib/pdfPreview';
import { placeSignatures } from '../lib/pdfSign';
import './sign.css';

const PAD_WIDTH = 480;
const PAD_HEIGHT = 160;
const DEFAULT_INK = '#1a1a2e';
const SAVED_KEY = 'classtools-pdf-signatures';
const SAVED_LIMIT = 6;
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

type PadMode = 'draw' | 'type';

interface SourceDoc {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

interface CapturedSignature {
  url: string;
  pngBytes: Uint8Array;
}

interface SavedSignature {
  id: string;
  dataUrl: string;
  createdAt: number;
}

interface SignStrings {
  title: string;
  dropLabel: string;
  dropHint: string;
  emptyHint: string;
  pages: (count: number) => string;
  encrypted: string;
  unreadable: (name: string) => string;
  pageLabel: (page: number) => string;
  previewOf: (page: number) => string;
  modeLabel: string;
  modeDraw: string;
  modeType: string;
  padAria: string;
  nameLabel: string;
  nameAria: string;
  namePlaceholder: string;
  brushLabel: string;
  colorLabel: string;
  clear: string;
  useSignature: string;
  emptyPad: string;
  captureError: string;
  ready: string;
  xLabel: string;
  yLabel: string;
  widthLabel: string;
  placementHint: string;
  signAction: string;
  working: string;
  resultText: string;
  download: string;
  opError: string;
  signAllPages: string;
  savedTitle: string;
  useSavedAria: (index: number) => string;
  deleteSavedAria: (index: number) => string;
}

const STRINGS: Record<'vi' | 'en', SignStrings> = {
  vi: {
    title: 'Ký PDF',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    emptyHint: 'Tải lên một tệp PDF để bắt đầu ký.',
    pages: (count) => `${count} trang`,
    encrypted: 'Tệp được bảo vệ bằng mật khẩu. Hãy mở khóa trước khi ký.',
    unreadable: (name) => `Không đọc được tệp: ${name}. Tệp có thể bị hỏng hoặc không phải PDF.`,
    pageLabel: (page) => `Trang ${page}`,
    previewOf: (page) => `Bản xem trước trang ${page}`,
    modeLabel: 'Kiểu chữ ký',
    modeDraw: 'VẼ',
    modeType: 'GÕ',
    padAria: 'Bảng ký',
    nameLabel: 'Tên chữ ký',
    nameAria: 'Nhập tên chữ ký',
    namePlaceholder: 'Nguyễn Văn A',
    brushLabel: 'Độ dày nét',
    colorLabel: 'Màu mực',
    clear: 'Xóa',
    useSignature: 'Sử dụng chữ ký',
    emptyPad: 'Chưa có chữ ký. Hãy vẽ nét hoặc nhập tên trước.',
    captureError: 'Không tạo được ảnh chữ ký. Hãy thử lại.',
    ready: 'Chữ ký đã sẵn sàng',
    xLabel: 'X (%)',
    yLabel: 'Y (%)',
    widthLabel: 'Rộng (%)',
    placementHint: 'Bấm vào bản xem trước để đặt vị trí',
    signAction: 'Ký & tải xuống',
    working: 'Đang xử lý…',
    resultText: 'Đã ký và tạo tệp PDF mới.',
    download: 'Tải xuống',
    opError: 'Không thể ký tệp PDF này. Tệp có thể bị hỏng hoặc không đúng chuẩn.',
    signAllPages: 'Ký tất cả các trang',
    savedTitle: 'Chữ ký đã lưu',
    useSavedAria: (index) => `Dùng chữ ký đã lưu ${index}`,
    deleteSavedAria: (index) => `Xóa chữ ký đã lưu ${index}`
  },
  en: {
    title: 'Sign PDF',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    emptyHint: 'Upload a PDF file to start signing.',
    pages: (count) => `${count} pages`,
    encrypted: 'This file is password protected. Unlock it before signing.',
    unreadable: (name) => `Could not read file: ${name}. It may be corrupted or not a PDF.`,
    pageLabel: (page) => `Page ${page}`,
    previewOf: (page) => `Preview of page ${page}`,
    modeLabel: 'Signature style',
    modeDraw: 'DRAW',
    modeType: 'TYPE',
    padAria: 'Signature pad',
    nameLabel: 'Signature name',
    nameAria: 'Type signature name',
    namePlaceholder: 'Your name',
    brushLabel: 'Brush size',
    colorLabel: 'Ink color',
    clear: 'Clear',
    useSignature: 'Use signature',
    emptyPad: 'No signature yet. Draw a stroke or type a name first.',
    captureError: 'Could not create the signature image. Please try again.',
    ready: 'Signature ready',
    xLabel: 'X (%)',
    yLabel: 'Y (%)',
    widthLabel: 'Width (%)',
    placementHint: 'Click the preview to set the position',
    signAction: 'Sign & download',
    working: 'Working…',
    resultText: 'Signed and a new PDF was created.',
    download: 'Download',
    opError: 'Could not sign this PDF. The file may be corrupted or not a valid PDF.',
    signAllPages: 'Sign every page',
    savedTitle: 'Saved signatures',
    useSavedAria: (index) => `Use saved signature ${index}`,
    deleteSavedAria: (index) => `Delete saved signature ${index}`
  }
};

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('BLOB_READ_FAILED'));
    reader.readAsArrayBuffer(blob);
  });
}

function createSignatureId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeSavedSignatures(raw: unknown): SavedSignature[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: SavedSignature[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const candidate = item as Partial<SavedSignature>;
    if (typeof candidate.id !== 'string' || candidate.id.length === 0) continue;
    if (typeof candidate.dataUrl !== 'string' || !candidate.dataUrl.startsWith(PNG_DATA_URL_PREFIX)) continue;
    if (typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt)) continue;
    if (seen.has(candidate.dataUrl)) continue;
    seen.add(candidate.dataUrl);
    result.push({ id: candidate.id, dataUrl: candidate.dataUrl, createdAt: candidate.createdAt });
    if (result.length >= SAVED_LIMIT) break;
  }
  return result;
}

function loadSavedSignatures(): SavedSignature[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return sanitizeSavedSignatures(JSON.parse(raw));
  } catch {
    return [];
  }
}

function persistSavedSignatures(list: SavedSignature[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, SAVED_LIMIT)));
  } catch {
    return;
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(PNG_DATA_URL_PREFIX.length));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function drawTypePreview(ctx: CanvasRenderingContext2D, text: string, color: string): void {
  let size = 64;
  ctx.font = `italic ${size}px Georgia, "Times New Roman", serif`;
  const measured = ctx.measureText(text).width;
  if (measured > PAD_WIDTH - 40 && measured > 0) {
    size = Math.max(24, Math.floor((size * (PAD_WIDTH - 40)) / measured));
    ctx.font = `italic ${size}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, PAD_WIDTH / 2, PAD_HEIGHT / 2);
}

interface PageCardProps {
  view: OpenedPdfView | null;
  pageNumber: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

function PageCard({ view, pageNumber, label, selected, onSelect }: PageCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failedView, setFailedView] = useState<OpenedPdfView | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!view || !canvas) return;
    let cancelled = false;
    view.render(pageNumber, canvas, 150).catch(() => {
      if (!cancelled) setFailedView(view);
    });
    return () => {
      cancelled = true;
    };
  }, [view, pageNumber]);

  const showCanvas = view !== null && failedView !== view;

  return (
    <button
      type="button"
      className={`thumb-card${selected ? ' thumb-card--selected' : ''}`}
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
    >
      <span className="thumb-card__badge">{pageNumber}</span>
      {showCanvas ? <canvas ref={canvasRef} /> : <span className="sign-thumb-fallback">{label}</span>}
      <span className="thumb-card__label">{label}</span>
    </button>
  );
}

interface SignPreviewProps {
  view: OpenedPdfView | null;
  pageNumber: number;
  fallbackLabel: string;
  markerX: number;
  markerY: number;
  wrapRef: RefObject<HTMLDivElement | null>;
  onPlaceClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

function SignPreview({ view, pageNumber, fallbackLabel, markerX, markerY, wrapRef, onPlaceClick }: SignPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failedView, setFailedView] = useState<OpenedPdfView | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!view || !canvas) return;
    let cancelled = false;
    view.render(pageNumber, canvas, 640).catch(() => {
      if (!cancelled) setFailedView(view);
    });
    return () => {
      cancelled = true;
    };
  }, [view, pageNumber]);

  const showCanvas = view !== null && failedView !== view;

  return (
    <div ref={wrapRef} className="sign-preview" aria-hidden="true" onClick={onPlaceClick}>
      {showCanvas ? <canvas ref={canvasRef} /> : <div className="sign-preview-fallback">{fallbackLabel}</div>}
      <span className="sign-marker" style={{ left: `${markerX}%`, top: `${markerY}%` }} />
    </div>
  );
}

export function SignPage() {
  const { locale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [source, setSource] = useState<SourceDoc | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<OpenedPdfView | null>(null);
  const [mode, setMode] = useState<PadMode>('draw');
  const [typeText, setTypeText] = useState('');
  const [brush, setBrush] = useState(4);
  const [inkColor, setInkColor] = useState(DEFAULT_INK);
  const [captured, setCaptured] = useState<CapturedSignature | null>(null);
  const [padError, setPadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSignature[]>(loadSavedSignatures);
  const [signAll, setSignAll] = useState(false);
  const [xPct, setXPct] = useState(60);
  const [yPct, setYPct] = useState(85);
  const [widthPct, setWidthPct] = useState(35);
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const padRef = useRef<HTMLCanvasElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const strokesRef = useRef(0);
  const brushRef = useRef(4);
  const inkRef = useRef(DEFAULT_INK);

  useEffect(() => {
    if (!source) return;
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
      .catch(() => undefined);
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [source]);

  useEffect(() => {
    const canvas = padRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === 'type' && typeText.trim()) {
      drawTypePreview(ctx, typeText.trim(), inkRef.current);
    }
  }, [mode, typeText]);

  const clearPad = useCallback(() => {
    drawingRef.current = false;
    strokesRef.current = 0;
    const canvas = padRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const switchMode = useCallback(
    (next: PadMode) => {
      if (next === mode) return;
      setMode(next);
      setPadError(null);
      clearPad();
    },
    [mode, clearPad]
  );

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      setNotice(undefined);
      setOpError(null);
      setResult(null);
      setSelected(0);
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
    [t]
  );

  const handleSelectPage = useCallback((index: number) => {
    setSelected(index);
    setOpError(null);
    setResult(null);
  }, []);

  const pointerPos = (event: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const handlePadDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = pointerPos(event);
    ctx.lineWidth = brushRef.current;
    ctx.lineCap = 'round';
    ctx.strokeStyle = inkRef.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePadMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || mode !== 'draw') return;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointerPos(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    strokesRef.current += 1;
  };

  const handleClear = useCallback(() => {
    setPadError(null);
    if (mode === 'type') setTypeText('');
    clearPad();
  }, [mode, clearPad]);

  const addSavedSignature = useCallback(
    (dataUrl: string) => {
      if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return;
      if (saved.some((item) => item.dataUrl === dataUrl)) return;
      const entry: SavedSignature = { id: createSignatureId(), dataUrl, createdAt: Date.now() };
      const next = [entry, ...saved].slice(0, SAVED_LIMIT);
      setSaved(next);
      persistSavedSignatures(next);
    },
    [saved]
  );

  const handleUseSaved = useCallback(
    (item: SavedSignature) => {
      try {
        const pngBytes = dataUrlToBytes(item.dataUrl);
        setCaptured((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url: item.dataUrl, pngBytes };
        });
        strokesRef.current = 1;
        setPadError(null);
        setOpError(null);
        setResult(null);
      } catch {
        setPadError(t.captureError);
      }
    },
    [t]
  );

  const handleDeleteSaved = useCallback(
    (id: string) => {
      const next = saved.filter((item) => item.id !== id);
      setSaved(next);
      persistSavedSignatures(next);
    },
    [saved]
  );

  const handleCapture = useCallback(async () => {
    const hasContent = mode === 'draw' ? strokesRef.current > 0 : Boolean(typeText.trim());
    if (!hasContent) {
      setPadError(t.emptyPad);
      return;
    }
    const canvas = padRef.current;
    if (!canvas) return;
    if (mode === 'type') {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawTypePreview(ctx, typeText.trim(), inkRef.current);
      }
    }
    setPadError(null);
    let dataUrl = '';
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch {
      dataUrl = '';
    }
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('BLOB_FAILED');
      const pngBytes = await blobToBytes(blob);
      setCaptured((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), pngBytes };
      });
      if (dataUrl.startsWith(PNG_DATA_URL_PREFIX)) addSavedSignature(dataUrl);
    } catch {
      setPadError(t.captureError);
    }
  }, [mode, typeText, t, addSavedSignature]);

  const handlePreviewClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = previewWrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setXPct(Math.min(100, Math.max(0, Math.round(x))));
    setYPct(Math.min(100, Math.max(0, Math.round(y))));
  }, []);

  const handleApply = useCallback(async () => {
    if (!source || !captured) return;
    setBusy(true);
    setOpError(null);
    setResult(null);
    try {
      const pdf = await PDFDocument.load(source.bytes, { updateMetadata: false });
      const placements = signAll
        ? Array.from({ length: source.pageCount }, (_, index) => ({
            pageIndex: index,
            pngBytes: captured.pngBytes,
            xPct,
            yPct,
            widthPct
          }))
        : [{ pageIndex: selected, pngBytes: captured.pngBytes, xPct, yPct, widthPct }];
      await placeSignatures(pdf, placements);
      const signed = new Uint8Array(await pdf.save());
      setSource((prev) => (prev ? { ...prev, bytes: signed } : prev));
      setResult(signed);
      setCaptured((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      strokesRef.current = 0;
      const canvas = padRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch {
      setOpError(t.opError);
    } finally {
      setBusy(false);
    }
  }, [source, captured, selected, signAll, xPct, yPct, widthPct, t]);

  const handleDownload = useCallback(() => {
    if (!result || !source) return;
    const base = baseName(source.file.name);
    downloadBytes(result, withPdfSuffix(`${base}-${vi ? 'da-ky' : 'signed'}`));
  }, [result, source, vi]);

  const pageNumbers = source ? Array.from({ length: source.pageCount }, (_, index) => index + 1) : [];

  return (
    <ToolShell>

      <div className="pdf-workspace pdf-workspace--side sign-workspace">
        <section className="ct-panel panel-section sign-source" aria-label={t.dropLabel}>
          <FileDrop compact={source !== null} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {source && (
            <>
              <div className="sign-source__info">
                <span className="sign-source__name">{fileSummary(source.file)}</span>
                <span className="ct-chip sign-chip">
                  <FileText size={13} aria-hidden="true" />
                  {t.pages(source.pageCount)}
                </span>
              </div>
              <div className="thumb-grid sign-grid">
                {pageNumbers.map((pageNumber) => (
                  <PageCard
                    key={pageNumber}
                    view={view}
                    pageNumber={pageNumber}
                    label={t.pageLabel(pageNumber)}
                    selected={selected === pageNumber - 1}
                    onSelect={() => handleSelectPage(pageNumber - 1)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="ct-panel panel-section sign-main" aria-label={t.title}>
          {source ? (
            <>
              <div className="sign-tabs" role="group" aria-label={t.modeLabel}>
                <button
                  type="button"
                  className={`sign-tab${mode === 'draw' ? ' is-active' : ''}`}
                  aria-pressed={mode === 'draw'}
                  onClick={() => switchMode('draw')}
                >
                  <PenLine size={15} aria-hidden="true" />
                  {t.modeDraw}
                </button>
                <button
                  type="button"
                  className={`sign-tab${mode === 'type' ? ' is-active' : ''}`}
                  aria-pressed={mode === 'type'}
                  onClick={() => switchMode('type')}
                >
                  <Type size={15} aria-hidden="true" />
                  {t.modeType}
                </button>
              </div>

              <div className="sign-pad-stack">
                {mode === 'type' && (
                  <label className="field">
                    <span>{t.nameLabel}</span>
                    <input
                      type="text"
                      value={typeText}
                      aria-label={t.nameAria}
                      placeholder={t.namePlaceholder}
                      onChange={(event) => setTypeText(event.target.value)}
                    />
                  </label>
                )}
                <canvas
                  ref={padRef}
                  className="sign-pad"
                  width={PAD_WIDTH}
                  height={PAD_HEIGHT}
                  role="img"
                  aria-label={t.padAria}
                  onPointerDown={handlePadDown}
                  onPointerMove={handlePadMove}
                  onPointerUp={endStroke}
                  onPointerLeave={endStroke}
                  onPointerCancel={endStroke}
                />
                <div className="sign-pad-tools">
                  {mode === 'draw' && (
                    <>
                      <label className="range-field sign-brush">
                        <span>{t.brushLabel}</span>
                        <input
                          type="range"
                          min={2}
                          max={10}
                          value={brush}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setBrush(value);
                            brushRef.current = value;
                          }}
                        />
                        <output>{brush}px</output>
                      </label>
                      <label className="field sign-color-field">
                        <span>{t.colorLabel}</span>
                        <input
                          type="color"
                          className="sign-color"
                          value={inkColor}
                          aria-label={t.colorLabel}
                          onChange={(event) => {
                            const next = event.target.value;
                            setInkColor(next);
                            inkRef.current = next;
                          }}
                        />
                      </label>
                    </>
                  )}
                  <button className="ct-button ct-button--soft" type="button" onClick={handleClear}>
                    <Eraser size={15} aria-hidden="true" />
                    {t.clear}
                  </button>
                  <button
                    className="ct-button ct-button--accent sign-capture"
                    type="button"
                    onClick={() => void handleCapture()}
                  >
                    {t.useSignature}
                  </button>
                </div>
                {padError && (
                  <p className="notice" role="alert">
                    {padError}
                  </p>
                )}
                {captured && (
                  <div className="sign-captured">
                    <img src={captured.url} alt={t.ready} className="sign-captured__img" />
                    <span className="ct-chip sign-ready">{t.ready}</span>
                  </div>
                )}
                {saved.length > 0 && (
                  <div className="sign-saved">
                    <span className="sign-saved__title">{t.savedTitle}</span>
                    <div className="sign-saved__list">
                      {saved.map((item, index) => (
                        <div key={item.id} className="sign-saved__item">
                          <button
                            type="button"
                            className="sign-saved__pick"
                            aria-label={t.useSavedAria(index + 1)}
                            onClick={() => handleUseSaved(item)}
                          >
                            <img src={item.dataUrl} alt="" className="sign-saved__img" />
                          </button>
                          <button
                            type="button"
                            className="sign-saved__delete"
                            aria-label={t.deleteSavedAria(index + 1)}
                            onClick={() => handleDeleteSaved(item.id)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="sign-placement">
                <div className="sign-placement-fields">
                  <label className="field">
                    <span>{t.xLabel}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={xPct}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) setXPct(Math.min(100, Math.max(0, value)));
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>{t.yLabel}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={yPct}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) setYPct(Math.min(100, Math.max(0, value)));
                      }}
                    />
                  </label>
                  <label className="range-field sign-width">
                    <span>{t.widthLabel}</span>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      value={widthPct}
                      onChange={(event) => setWidthPct(Number(event.target.value))}
                    />
                    <output>{widthPct}%</output>
                  </label>
                  <label className="sign-all-pages">
                    <input
                      type="checkbox"
                      checked={signAll}
                      aria-label={t.signAllPages}
                      onChange={(event) => setSignAll(event.target.checked)}
                    />
                    <span>{t.signAllPages}</span>
                  </label>
                </div>
                <p className="sign-hint">{t.placementHint}</p>
                <SignPreview
                  view={view}
                  pageNumber={selected + 1}
                  fallbackLabel={t.previewOf(selected + 1)}
                  markerX={xPct}
                  markerY={yPct}
                  wrapRef={previewWrapRef}
                  onPlaceClick={handlePreviewClick}
                />
              </div>

              <div className="action-bar">
                <button
                  className="ct-button ct-button--primary sign-action"
                  type="button"
                  disabled={!captured || busy}
                  onClick={() => void handleApply()}
                >
                  {busy ? <span className="spinner" aria-hidden="true" /> : <FileSignature size={17} aria-hidden="true" />}
                  {busy ? t.working : t.signAction}
                </button>
              </div>

              {opError && (
                <p className="notice" role="alert">
                  {opError}
                </p>
              )}

              {result && (
                <div className="notice notice--ok sign-result" role="status">
                  <span>{t.resultText}</span>
                  <button className="ct-button ct-button--accent" type="button" onClick={handleDownload}>
                    <Download size={16} aria-hidden="true" />
                    {t.download}
                  </button>
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
