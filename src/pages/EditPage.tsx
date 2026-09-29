import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  Download,
  FileText,
  Hash,
  ImagePlus,
  Layers,
  MousePointerClick,
  PenLine,
  Stamp,
  Trash2,
  Type
} from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, readFileBytes, withPdfSuffix } from '../lib/download';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import { openPdfView } from '../lib/pdfPreview';
import type { OpenedPdfView } from '../lib/pdfPreview';
import {
  addImageLayers,
  addImageWatermark,
  addPageNumbers,
  addTextLayers,
  addWatermark,
  ensureEmbeddedFonts,
  type NumberPosition
} from '../lib/pdfEdit';
import './edit.css';

interface SourceDoc {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

interface TextLayerDraft {
  id: number;
  pageIndex: number;
  text: string;
  fontSizePt: number;
  colorHex: string;
  bold: boolean;
  xPct: number;
  yPct: number;
}

interface ImageLayerDraft {
  id: number;
  pageIndex: number;
  bytes: Uint8Array;
  name: string;
  widthPct: number;
  xPct: number;
  yPct: number;
  previewUrl: string;
}

interface WatermarkDraft {
  text: string;
  fontSizePt: number;
  colorHex: string;
  opacity: number;
  angle: number;
}

interface WatermarkImageDraft {
  bytes: Uint8Array;
  name: string;
  previewUrl: string;
}

type WatermarkSource = 'text' | 'image';

type LayerChip =
  | { kind: 'text'; id: number; xPct: number; yPct: number }
  | { kind: 'image'; id: number; xPct: number; yPct: number; previewUrl: string };

interface PageNumberDraft {
  position: NumberPosition;
  startAt: number;
  template: string;
  fontSizePt: number;
  skipFirst: boolean;
}

interface EditStrings {
  title: string;
  dropLabel: string;
  dropHint: string;
  emptyHint: string;
  pages: (count: number) => string;
  encrypted: string;
  unreadable: (name: string) => string;
  pageLabel: (page: number) => string;
  previewOf: (page: number) => string;
  targetPage: string;
  layersTitle: string;
  layersEmpty: string;
  layerText: (text: string, page: number) => string;
  layerImage: (name: string, page: number) => string;
  textTitle: string;
  textContent: string;
  textContentPlaceholder: string;
  fontSize: string;
  color: string;
  bold: string;
  addText: string;
  imageTitle: string;
  chooseImage: string;
  imageWidth: string;
  addImage: string;
  watermarkTitle: string;
  watermarkText: string;
  watermarkTextPlaceholder: string;
  watermarkSize: string;
  watermarkOpacity: string;
  watermarkAngle: string;
  watermarkSourceText: string;
  watermarkSourceImage: string;
  watermarkChooseImage: string;
  watermarkImageWidth: string;
  watermarkPositionX: string;
  watermarkPositionY: string;
  numbersTitle: string;
  numbersEnable: string;
  numbersPosition: string;
  positionBottomLeft: string;
  positionBottomCenter: string;
  positionBottomRight: string;
  positionTopLeft: string;
  positionTopCenter: string;
  positionTopRight: string;
  numbersStart: string;
  numbersTemplate: string;
  numbersSkipFirst: string;
  positionHint: string;
  apply: string;
  working: string;
  nothingPending: string;
  resultText: string;
  download: string;
  outputName: string;
  opError: string;
}

const STRINGS: Record<'vi' | 'en', EditStrings> = {
  vi: {
    title: 'Chỉnh sửa PDF',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    emptyHint: 'Tải lên một tệp PDF để bắt đầu chỉnh sửa.',
    pages: (count) => `${count} trang`,
    encrypted: 'Tệp được bảo vệ bằng mật khẩu. Hãy mở khóa trước khi chỉnh sửa.',
    unreadable: (name) => `Không đọc được tệp: ${name}. Tệp có thể bị hỏng hoặc không phải PDF.`,
    pageLabel: (page) => `Trang ${page}`,
    previewOf: (page) => `Bản xem trước trang ${page}`,
    targetPage: 'Trang đích',
    layersTitle: 'Lớp đang thêm',
    layersEmpty: 'Chưa có lớp nào. Hãy thêm chữ hoặc ảnh.',
    layerText: (text, page) => `Chữ "${text.slice(0, 24)}" — trang ${page}`,
    layerImage: (name, page) => `Ảnh ${name} — trang ${page}`,
    textTitle: 'Thêm chữ',
    textContent: 'Nội dung',
    textContentPlaceholder: 'Ghi chú của giáo viên…',
    fontSize: 'Cỡ chữ (pt)',
    color: 'Màu',
    bold: 'In đậm',
    addText: 'Thêm chữ',
    imageTitle: 'Chèn ảnh',
    chooseImage: 'Chọn ảnh (PNG/JPG)',
    imageWidth: 'Rộng ảnh (%)',
    addImage: 'Thêm ảnh',
    watermarkTitle: 'Dấu mờ (tất cả trang)',
    watermarkText: 'Nội dung dấu mờ',
    watermarkTextPlaceholder: 'VD: TÀI LIỆU NỘI BỘ',
    watermarkSize: 'Cỡ (pt)',
    watermarkOpacity: 'Độ mờ',
    watermarkAngle: 'Góc nghiêng (°)',
    watermarkSourceText: 'Chữ',
    watermarkSourceImage: 'Ảnh',
    watermarkChooseImage: 'Chọn ảnh dấu mờ (PNG/JPG)',
    watermarkImageWidth: 'Rộng ảnh (%)',
    watermarkPositionX: 'Vị trí X (%)',
    watermarkPositionY: 'Vị trí Y (%)',
    numbersTitle: 'Số trang',
    numbersEnable: 'Bật đánh số trang',
    numbersPosition: 'Vị trí',
    positionBottomLeft: 'Dưới – trái',
    positionBottomCenter: 'Dưới – giữa',
    positionBottomRight: 'Dưới – phải',
    positionTopLeft: 'Trên – trái',
    positionTopCenter: 'Trên – giữa',
    positionTopRight: 'Trên – phải',
    numbersStart: 'Bắt đầu từ',
    numbersTemplate: 'Định dạng ({n}, {total})',
    numbersSkipFirst: 'Bỏ qua trang đầu',
    positionHint: 'Bấm vào bản xem trước để đặt vị trí',
    apply: 'Áp dụng & tải xuống',
    working: 'Đang xử lý…',
    nothingPending: 'Chưa có thay đổi nào để áp dụng.',
    resultText: 'Đã lưu bản chỉnh sửa.',
    download: 'Tải xuống',
    outputName: 'Tên tệp xuất ra',
    opError: 'Không thể chỉnh sửa tệp PDF này. Tệp có thể bị hỏng hoặc không đúng chuẩn.'
  },
  en: {
    title: 'Edit PDF',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    emptyHint: 'Upload a PDF file to start editing.',
    pages: (count) => `${count} pages`,
    encrypted: 'This file is password protected. Unlock it before editing.',
    unreadable: (name) => `Could not read file: ${name}. It may be corrupted or not a PDF.`,
    pageLabel: (page) => `Page ${page}`,
    previewOf: (page) => `Preview of page ${page}`,
    targetPage: 'Target page',
    layersTitle: 'Pending layers',
    layersEmpty: 'No layers yet. Add text or an image.',
    layerText: (text, page) => `Text "${text.slice(0, 24)}" — page ${page}`,
    layerImage: (name, page) => `Image ${name} — page ${page}`,
    textTitle: 'Add text',
    textContent: 'Content',
    textContentPlaceholder: 'Teacher note…',
    fontSize: 'Font size (pt)',
    color: 'Color',
    bold: 'Bold',
    addText: 'Add text',
    imageTitle: 'Insert image',
    chooseImage: 'Choose image (PNG/JPG)',
    imageWidth: 'Image width (%)',
    addImage: 'Add image',
    watermarkTitle: 'Watermark (all pages)',
    watermarkText: 'Watermark text',
    watermarkTextPlaceholder: 'e.g. INTERNAL USE',
    watermarkSize: 'Size (pt)',
    watermarkOpacity: 'Opacity',
    watermarkAngle: 'Angle (°)',
    watermarkSourceText: 'Text',
    watermarkSourceImage: 'Image',
    watermarkChooseImage: 'Choose watermark image (PNG/JPG)',
    watermarkImageWidth: 'Image width (%)',
    watermarkPositionX: 'Position X (%)',
    watermarkPositionY: 'Position Y (%)',
    numbersTitle: 'Page numbers',
    numbersEnable: 'Enable page numbers',
    numbersPosition: 'Position',
    positionBottomLeft: 'Bottom – left',
    positionBottomCenter: 'Bottom – center',
    positionBottomRight: 'Bottom – right',
    positionTopLeft: 'Top – left',
    positionTopCenter: 'Top – center',
    positionTopRight: 'Top – right',
    numbersStart: 'Start at',
    numbersTemplate: 'Format ({n}, {total})',
    numbersSkipFirst: 'Skip first page',
    positionHint: 'Click the preview to set the position',
    apply: 'Apply & download',
    working: 'Working…',
    nothingPending: 'No changes to apply yet.',
    resultText: 'Edits saved.',
    download: 'Download',
    outputName: 'Output file name',
    opError: 'Could not edit this PDF. The file may be corrupted or not a valid PDF.'
  }
};

const POSITION_LABELS: Record<'vi' | 'en', Record<NumberPosition, string>> = {
  vi: {
    'bottom-left': 'Dưới – trái',
    'bottom-center': 'Dưới – giữa',
    'bottom-right': 'Dưới – phải',
    'top-left': 'Trên – trái',
    'top-center': 'Trên – giữa',
    'top-right': 'Trên – phải'
  },
  en: {
    'bottom-left': 'Bottom – left',
    'bottom-center': 'Bottom – center',
    'bottom-right': 'Bottom – right',
    'top-left': 'Top – left',
    'top-center': 'Top – center',
    'top-right': 'Top – right'
  }
};

function readImageBytes(file: File): Promise<Uint8Array> {
  return readFileBytes(file).then((buffer) => new Uint8Array(buffer));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

interface PageCardProps {
  view: OpenedPdfView | null;
  pageNumber: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

function PreviewCanvas({ view, pageNumber, fallbackLabel }: { view: OpenedPdfView | null; pageNumber: number; fallbackLabel: string }) {
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
    <>
      {showCanvas ? <canvas ref={canvasRef} /> : <div className="edit-preview-fallback">{fallbackLabel}</div>}
    </>
  );
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
      {showCanvas ? <canvas ref={canvasRef} /> : <span className="edit-thumb-fallback">{label}</span>}
      <span className="thumb-card__label">{label}</span>
    </button>
  );
}

export function EditPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [source, setSource] = useState<SourceDoc | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<OpenedPdfView | null>(null);

  const [textDraft, setTextDraft] = useState('');
  const [textSize, setTextSize] = useState(14);
  const [textColor, setTextColor] = useState('#25223f');
  const [textBold, setTextBold] = useState(false);
  const [textLayers, setTextLayers] = useState<TextLayerDraft[]>([]);

  const [imageWidth, setImageWidth] = useState(40);
  const [imageLayers, setImageLayers] = useState<ImageLayerDraft[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);

  const [watermark, setWatermark] = useState<WatermarkDraft>({
    text: '',
    fontSizePt: 48,
    colorHex: '#8b86ad',
    opacity: 0.15,
    angle: 45
  });
  const [wmSource, setWmSource] = useState<WatermarkSource>('text');
  const [wmImage, setWmImage] = useState<WatermarkImageDraft | null>(null);
  const [wmImageWidth, setWmImageWidth] = useState(45);
  const [wmImageX, setWmImageX] = useState(50);
  const [wmImageY, setWmImageY] = useState(50);

  const [numbers, setNumbers] = useState<PageNumberDraft>({
    position: 'bottom-center',
    startAt: 1,
    template: '{n} / {total}',
    fontSizePt: 11,
    skipFirst: false
  });
  const [numbersEnabled, setNumbersEnabled] = useState(false);

  const [posX, setPosX] = useState(10);
  const [posY, setPosY] = useState(10);
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragRef = useRef<{ kind: 'text' | 'image'; id: number } | null>(null);

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

  const watermarkPending = wmSource === 'text' ? watermark.text.trim() !== '' : wmImage !== null;
  const hasPending =
    textLayers.length > 0 ||
    imageLayers.length > 0 ||
    watermarkPending ||
    numbersEnabled;

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

  const handleAddText = useCallback(() => {
    if (!textDraft.trim()) return;
    seqRef.current += 1;
    setTextLayers((layers) => [
      ...layers,
      {
        id: seqRef.current,
        pageIndex: selected,
        text: textDraft.trim(),
        fontSizePt: textSize,
        colorHex: textColor,
        bold: textBold,
        xPct: posX,
        yPct: posY
      }
    ]);
    setTextDraft('');
    setOpError(null);
  }, [textDraft, textSize, textColor, textBold, selected, posX, posY]);

  const handleRemoveText = useCallback((id: number) => {
    setTextLayers((layers) => layers.filter((layer) => layer.id !== id));
  }, []);

  const handleImagePicked = useCallback(
    (picked: File | null) => {
      if (!picked) return;
      setOpError(null);
      void readImageBytes(picked).then((bytes) => {
        seqRef.current += 1;
        setImageLayers((layers) => [
          ...layers,
          {
            id: seqRef.current,
            pageIndex: selected,
            bytes,
            name: picked.name,
            widthPct: imageWidth,
            xPct: posX,
            yPct: posY,
            previewUrl: URL.createObjectURL(picked)
          }
        ]);
      });
    },
    [selected, imageWidth, posX, posY]
  );

  const handleRemoveImage = useCallback((id: number) => {
    setImageLayers((layers) => {
      const target = layers.find((layer) => layer.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return layers.filter((layer) => layer.id !== id);
    });
  }, []);

  const handleWmImagePicked = useCallback((picked: File | null) => {
    if (!picked) return;
    setOpError(null);
    void readImageBytes(picked).then((bytes) => {
      setWmImage((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return { bytes, name: picked.name, previewUrl: URL.createObjectURL(picked) };
      });
    });
  }, []);

  const handlePreviewClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as Element | null;
      if (target?.closest('[data-layer-id]')) return;
      const rect = previewWrapRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
      const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
      setPosX(x);
      setPosY(y);
      if (wmSource === 'image') {
        setWmImageX(x);
        setWmImageY(y);
      }
    },
    [wmSource]
  );

  const handleChipPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>, kind: 'text' | 'image', id: number) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { kind, id };
    setDraggingId(id);
  }, []);

  useEffect(() => {
    if (draggingId === null) return;
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== draggingId) return;
      const rect = previewWrapRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const xPct = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
      const yPct = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
      if (drag.kind === 'text') {
        setTextLayers((layers) => layers.map((layer) => (layer.id === draggingId ? { ...layer, xPct, yPct } : layer)));
      } else {
        setImageLayers((layers) => layers.map((layer) => (layer.id === draggingId ? { ...layer, xPct, yPct } : layer)));
      }
    };
    const handleEnd = () => {
      dragRef.current = null;
      setDraggingId(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [draggingId]);

  const handleApply = useCallback(async () => {
    if (!source || !hasPending) return;
    setBusy(true);
    setOpError(null);
    setResult(null);
    try {
      const pdf = await PDFDocument.load(source.bytes, { updateMetadata: false });
      const fonts = await ensureEmbeddedFonts(pdf);
      if (textLayers.length) {
        await addTextLayers(
          pdf,
          fonts,
          textLayers.map((layer) => ({
            pageIndex: layer.pageIndex,
            text: layer.text,
            xPct: layer.xPct,
            yPct: layer.yPct,
            fontSizePt: layer.fontSizePt,
            colorHex: layer.colorHex,
            bold: layer.bold
          }))
        );
      }
      if (imageLayers.length) {
        await addImageLayers(
          pdf,
          imageLayers.map((layer) => ({
            pageIndex: layer.pageIndex,
            bytes: layer.bytes,
            xPct: layer.xPct,
            yPct: layer.yPct,
            widthPct: layer.widthPct
          }))
        );
      }
      if (wmSource === 'text' && watermark.text.trim()) {
        await addWatermark(pdf, fonts.regular, {
          text: watermark.text.trim(),
          fontSizePt: watermark.fontSizePt,
          colorHex: watermark.colorHex,
          opacity: watermark.opacity,
          angle: watermark.angle
        });
      } else if (wmSource === 'image' && wmImage) {
        await addImageWatermark(pdf, {
          bytes: wmImage.bytes,
          widthPct: wmImageWidth,
          opacity: watermark.opacity,
          angle: watermark.angle,
          xPct: wmImageX,
          yPct: wmImageY
        });
      }
      if (numbersEnabled) {
        await addPageNumbers(pdf, fonts.regular, {
          position: numbers.position,
          startAt: numbers.startAt,
          template: numbers.template,
          fontSizePt: numbers.fontSizePt,
          skipFirst: numbers.skipFirst,
          colorHex: '#25223f'
        });
      }
      const edited = new Uint8Array(await pdf.save());
      setSource((prev) => (prev ? { ...prev, bytes: edited } : prev));
      setResult(edited);
      setTextLayers([]);
      setImageLayers((layers) => {
        layers.forEach((layer) => URL.revokeObjectURL(layer.previewUrl));
        return [];
      });
    } catch {
      setOpError(t.opError);
    } finally {
      setBusy(false);
    }
  }, [source, hasPending, textLayers, imageLayers, watermark, wmSource, wmImage, wmImageWidth, wmImageX, wmImageY, numbers, numbersEnabled, t]);

  const handleDownload = useCallback(() => {
    if (!result || !source) return;
    const base = source.file.name.replace(/\.pdf$/i, '');
    const name = `${base}-${vi ? 'da-chinh-sua' : 'edited'}`;
    downloadBytes(result, withPdfSuffix(name));
  }, [result, source, vi]);

  const pageNumbers = source ? Array.from({ length: source.pageCount }, (_, index) => index + 1) : [];

  const layerChips: LayerChip[] = [
    ...textLayers
      .filter((layer) => layer.pageIndex === selected)
      .map((layer) => ({ kind: 'text' as const, id: layer.id, xPct: layer.xPct, yPct: layer.yPct })),
    ...imageLayers
      .filter((layer) => layer.pageIndex === selected)
      .map((layer) => ({ kind: 'image' as const, id: layer.id, xPct: layer.xPct, yPct: layer.yPct, previewUrl: layer.previewUrl }))
  ];

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>

      <div className="pdf-workspace pdf-workspace--side edit-workspace">
        <section className="ct-panel panel-section edit-source" aria-label={t.dropLabel}>
          <FileDrop compact={source !== null} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {source && (
            <>
              <div className="edit-source__info">
                <span className="edit-source__name">{fileSummary(source.file)}</span>
                <span className="ct-chip edit-chip">
                  <FileText size={13} aria-hidden="true" />
                  {t.pages(source.pageCount)}
                </span>
              </div>
              <div className="thumb-grid edit-grid">
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

        <section className="ct-panel panel-section edit-main" aria-label={t.title}>
          {source ? (
            <>
              <div className="edit-layers">
                <div className="edit-layers__head">
                  <h2><Layers size={16} aria-hidden="true" /> {t.layersTitle}</h2>
                  <span className="ct-chip">{textLayers.length + imageLayers.length}</span>
                </div>
                {textLayers.length + imageLayers.length === 0 ? (
                  <p className="edit-layers__empty">{t.layersEmpty}</p>
                ) : (
                  <ul className="edit-layers__list">
                    {textLayers.map((layer) => (
                      <li key={`t${layer.id}`}>
                        <Type size={14} aria-hidden="true" />
                        <span>{t.layerText(layer.text, layer.pageIndex + 1)}</span>
                        <button
                          className="ct-icon-button"
                          type="button"
                          aria-label={`Xóa lớp chữ: ${layer.text}`}
                          onClick={() => handleRemoveText(layer.id)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                    {imageLayers.map((layer) => (
                      <li key={`i${layer.id}`}>
                        <img src={layer.previewUrl} alt="" className="edit-layers__thumb" />
                        <span>{t.layerImage(layer.name, layer.pageIndex + 1)}</span>
                        <button
                          className="ct-icon-button"
                          type="button"
                          aria-label={`Xóa lớp ảnh: ${layer.name}`}
                          onClick={() => handleRemoveImage(layer.id)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="edit-forms">
                <div className="edit-form">
                  <h3><Type size={15} aria-hidden="true" /> {t.textTitle}</h3>
                  <label className="field">
                    <span>{t.textContent}</span>
                    <textarea
                      rows={3}
                      value={textDraft}
                      aria-label={t.textContent}
                      placeholder={t.textContentPlaceholder}
                      onChange={(event) => setTextDraft(event.target.value)}
                    />
                  </label>
                  <div className="edit-form__row">
                    <label className="range-field">
                      <span>{t.fontSize}</span>
                      <input type="range" min={8} max={48} value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} />
                      <output>{textSize}</output>
                    </label>
                    <label className="field">
                      <span>{t.color}</span>
                      <input type="color" value={textColor} aria-label={t.color} onChange={(event) => setTextColor(event.target.value)} />
                    </label>
                    <label className="edit-checkbox">
                      <input type="checkbox" checked={textBold} onChange={(event) => setTextBold(event.target.checked)} />
                      {t.bold}
                    </label>
                  </div>
                  <button className="ct-button ct-button--soft edit-add" type="button" disabled={!textDraft.trim()} onClick={handleAddText}>
                    <Type size={15} aria-hidden="true" /> {t.addText}
                  </button>
                </div>

                <div className="edit-form">
                  <h3><ImagePlus size={15} aria-hidden="true" /> {t.imageTitle}</h3>
                  <label className="field">
                    <span>{t.chooseImage}</span>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      aria-label={t.chooseImage}
                      onChange={(event) => {
                        handleImagePicked(event.target.files?.[0] ?? null);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <label className="range-field">
                    <span>{t.imageWidth}</span>
                    <input type="range" min={5} max={100} value={imageWidth} onChange={(event) => setImageWidth(Number(event.target.value))} />
                    <output>{imageWidth}%</output>
                  </label>
                </div>

                <div className="edit-form">
                  <h3><Stamp size={15} aria-hidden="true" /> {t.watermarkTitle}</h3>
                  <div className="edit-wm-tabs" role="group" aria-label={t.watermarkTitle}>
                    <button
                      type="button"
                      className="edit-wm-tab"
                      aria-pressed={wmSource === 'text'}
                      onClick={() => setWmSource('text')}
                    >
                      {t.watermarkSourceText}
                    </button>
                    <button
                      type="button"
                      className="edit-wm-tab"
                      aria-pressed={wmSource === 'image'}
                      onClick={() => setWmSource('image')}
                    >
                      {t.watermarkSourceImage}
                    </button>
                  </div>
                  {wmSource === 'text' ? (
                    <label className="field">
                      <span>{t.watermarkText}</span>
                      <input
                        type="text"
                        value={watermark.text}
                        placeholder={t.watermarkTextPlaceholder}
                        onChange={(event) => setWatermark((current) => ({ ...current, text: event.target.value }))}
                      />
                    </label>
                  ) : (
                    <>
                      <label className="field">
                        <span>{t.watermarkChooseImage}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          aria-label={t.watermarkChooseImage}
                          onChange={(event) => {
                            handleWmImagePicked(event.target.files?.[0] ?? null);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <label className="range-field">
                        <span>{t.watermarkImageWidth}</span>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={wmImageWidth}
                          onChange={(event) => setWmImageWidth(Number(event.target.value))}
                        />
                        <output>{wmImageWidth}%</output>
                      </label>
                      <div className="edit-form__row">
                        <label className="field">
                          <span>{t.watermarkPositionX}</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={wmImageX}
                            onChange={(event) => setWmImageX(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
                          />
                        </label>
                        <label className="field">
                          <span>{t.watermarkPositionY}</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={wmImageY}
                            onChange={(event) => setWmImageY(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  <div className="edit-form__row">
                    <label className="range-field">
                      <span>{t.watermarkSize}</span>
                      <input type="range" min={12} max={120} value={watermark.fontSizePt} onChange={(event) => setWatermark((current) => ({ ...current, fontSizePt: Number(event.target.value) }))} />
                      <output>{watermark.fontSizePt}</output>
                    </label>
                    <label className="range-field">
                      <span>{t.watermarkOpacity}</span>
                      <input type="range" min={5} max={100} value={Math.round(watermark.opacity * 100)} onChange={(event) => setWatermark((current) => ({ ...current, opacity: Number(event.target.value) / 100 }))} />
                      <output>{Math.round(watermark.opacity * 100)}%</output>
                    </label>
                    <label className="range-field">
                      <span>{t.watermarkAngle}</span>
                      <input type="range" min={0} max={90} value={watermark.angle} onChange={(event) => setWatermark((current) => ({ ...current, angle: Number(event.target.value) }))} />
                      <output>{watermark.angle}°</output>
                    </label>
                  </div>
                </div>

                <div className="edit-form">
                  <h3><Hash size={15} aria-hidden="true" /> {t.numbersTitle}</h3>
                  <label className="edit-checkbox">
                    <input type="checkbox" checked={numbersEnabled} onChange={(event) => setNumbersEnabled(event.target.checked)} />
                    {t.numbersEnable}
                  </label>
                  {numbersEnabled && (
                    <div className="edit-form__stack">
                      <label className="field">
                        <span>{t.numbersPosition}</span>
                        <select
                          value={numbers.position}
                          onChange={(event) => setNumbers((current) => ({ ...current, position: event.target.value as NumberPosition }))}
                        >
                          {(Object.keys(POSITION_LABELS[locale]) as NumberPosition[]).map((position) => (
                            <option key={position} value={position}>{POSITION_LABELS[locale][position]}</option>
                          ))}
                        </select>
                      </label>
                      <div className="edit-form__row">
                        <label className="field">
                          <span>{t.numbersStart}</span>
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            value={numbers.startAt}
                            onChange={(event) => setNumbers((current) => ({ ...current, startAt: Math.max(0, Math.min(9999, Number(event.target.value) || 0)) }))}
                          />
                        </label>
                        <label className="field">
                          <span>{t.numbersTemplate}</span>
                          <input
                            type="text"
                            value={numbers.template}
                            onChange={(event) => setNumbers((current) => ({ ...current, template: event.target.value }))}
                          />
                        </label>
                      </div>
                      <label className="edit-checkbox">
                        <input type="checkbox" checked={numbers.skipFirst} onChange={(event) => setNumbers((current) => ({ ...current, skipFirst: event.target.checked }))} />
                        {t.numbersSkipFirst}
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="edit-preview">
                <p className="edit-hint"><MousePointerClick size={14} aria-hidden="true" /> {t.positionHint}</p>
                <div
                  ref={previewWrapRef}
                  className={`edit-preview-wrap${draggingId !== null ? ' edit-preview-wrap--dragging' : ''}`}
                  aria-hidden="true"
                  onClick={handlePreviewClick}
                >
                  <PreviewCanvas view={view} pageNumber={selected + 1} fallbackLabel={t.previewOf(selected + 1)} />
                  <span className="edit-marker" style={{ left: `${posX}%`, top: `${posY}%` }} />
                  {layerChips.map((chip) => (
                    <div
                      key={`${chip.kind}-${chip.id}`}
                      data-layer-id={chip.id}
                      className={`edit-layer-chip${draggingId === chip.id ? ' edit-layer-chip--dragging' : ''}`}
                      style={{ left: `${chip.xPct}%`, top: `${chip.yPct}%` }}
                      onPointerDown={(event) => handleChipPointerDown(event, chip.kind, chip.id)}
                    >
                      {chip.kind === 'text' ? (
                        <span className="edit-layer-chip__label">Aa</span>
                      ) : (
                        <img src={chip.previewUrl} alt="" className="edit-layer-chip__img" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="action-bar">
                <button
                  className="ct-button ct-button--primary edit-action"
                  type="button"
                  disabled={!hasPending || busy}
                  title={!hasPending ? t.nothingPending : undefined}
                  onClick={() => void handleApply()}
                >
                  {busy ? <span className="spinner" aria-hidden="true" /> : <PenLine size={17} aria-hidden="true" />}
                  {busy ? t.working : t.apply}
                </button>
              </div>

              {opError && (
                <p className="notice" role="alert">{opError}</p>
              )}

              {result && (
                <div className="notice notice--ok edit-result" role="status">
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
