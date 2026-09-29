import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FilePlus,
  FileText,
  LayoutList,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2
} from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, withPdfSuffix } from '../lib/download';
import {
  EncryptedPdfError,
  getPdfPageCount,
  removePages,
  reorderPages,
  rotatePages,
  type RotationDegrees
} from '../lib/pdfOps';
import { openPdfView, type OpenedPdfView } from '../lib/pdfPreview';
import { duplicatePages, insertBlankPage } from '../lib/pdfPages';
import './organize.css';

const MAX_FILE_BYTES = 100 * 1024 * 1024;

interface OrgCard {
  id: number;
  src: number;
}

interface SourceDoc {
  bytes: Uint8Array;
  pageCount: number;
  name: string;
}

interface OrganizeStrings {
  back: string;
  title: string;
  description: string;
  dropLabel: string;
  dropHint: string;
  emptyHint: string;
  pages: (count: number) => string;
  rotated: (count: number) => string;
  removed: (count: number) => string;
  apply: string;
  applying: string;
  reset: string;
  saved: (count: number) => string;
  download: string;
  rotateLeft: (page: number) => string;
  rotateRight: (page: number) => string;
  moveUp: (page: number) => string;
  moveDown: (page: number) => string;
  remove: (page: number) => string;
  restore: (page: number) => string;
  duplicate: (page: number) => string;
  reverse: string;
  insertBlank: string;
  pageLabel: (page: number, rotation: number) => string;
  oversized: string;
  encrypted: string;
  unreadable: string;
  opError: string;
}

const STRINGS: Record<'vi' | 'en', OrganizeStrings> = {
  vi: {
    back: 'Trang chủ',
    title: 'Sắp xếp trang',
    description:
      'Xem trước từng trang, xoay, xóa và đổi thứ tự rồi áp dụng một lần duy nhất. Mọi thao tác chạy ngay trên thiết bị của bạn.',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    emptyHint: 'Tải lên một tệp PDF để bắt đầu sắp xếp trang.',
    pages: (count) => `${count} trang`,
    rotated: (count) => `đã xoay ${count}`,
    removed: (count) => `đã xóa ${count}`,
    apply: 'Áp dụng thay đổi',
    applying: 'Đang áp dụng…',
    reset: 'Đặt lại',
    saved: (count) => `Đã lưu: ${count} trang`,
    download: 'Tải xuống',
    rotateLeft: (page) => `Xoay trái trang ${page}`,
    rotateRight: (page) => `Xoay phải trang ${page}`,
    moveUp: (page) => `Di chuyển trang ${page} lên trên`,
    moveDown: (page) => `Di chuyển trang ${page} xuống dưới`,
    remove: (page) => `Xóa trang ${page}`,
    restore: (page) => `Khôi phục trang ${page}`,
    duplicate: (page) => `Nhân đôi trang ${page}`,
    reverse: 'Đảo ngược',
    insertBlank: 'Chèn trang trắng',
    pageLabel: (page, rotation) => (rotation ? `Trang ${page} · ${rotation}°` : `Trang ${page}`),
    oversized: 'Bỏ qua tệp quá 100 MB.',
    encrypted: 'Tệp được bảo vệ bằng mật khẩu nên không thể xử lý.',
    unreadable: 'Không đọc được tệp. Tệp có thể bị hỏng hoặc không phải PDF.',
    opError: 'Không thể áp dụng thay đổi. Vui lòng thử lại.'
  },
  en: {
    back: 'Home',
    title: 'Organize Pages',
    description:
      'Preview each page, rotate, delete and reorder, then apply everything in one go. Everything runs on your device.',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    emptyHint: 'Upload a PDF file to start organizing pages.',
    pages: (count) => `${count} pages`,
    rotated: (count) => `${count} rotated`,
    removed: (count) => `${count} deleted`,
    apply: 'Apply changes',
    applying: 'Applying…',
    reset: 'Reset',
    saved: (count) => `Saved: ${count} pages`,
    download: 'Download',
    rotateLeft: (page) => `Rotate page ${page} left`,
    rotateRight: (page) => `Rotate page ${page} right`,
    moveUp: (page) => `Move page ${page} up`,
    moveDown: (page) => `Move page ${page} down`,
    remove: (page) => `Delete page ${page}`,
    restore: (page) => `Restore page ${page}`,
    duplicate: (page) => `Duplicate page ${page}`,
    reverse: 'Reverse',
    insertBlank: 'Insert blank',
    pageLabel: (page, rotation) => (rotation ? `Page ${page} · ${rotation}°` : `Page ${page}`),
    oversized: 'Skipped files over 100 MB.',
    encrypted: 'This file is password protected and cannot be processed.',
    unreadable: 'Could not read the file. It may be corrupted or not a PDF.',
    opError: 'Could not apply the changes. Please try again.'
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

function identityCards(count: number): OrgCard[] {
  return Array.from({ length: count }, (_, index) => ({ id: index, src: index }));
}

interface OrgPageCardProps {
  view: OpenedPdfView | null;
  pageNumber: number;
  badge: number;
  rotation: number;
  label: string;
  dimmed: boolean;
  first: boolean;
  last: boolean;
  busy: boolean;
  duplicating: boolean;
  t: OrganizeStrings;
  onRotate: (delta: 90 | 270) => void;
  onMove: (delta: -1 | 1) => void;
  onToggleDelete: () => void;
  onDuplicate: () => void;
  onDragStartCard: () => void;
  onDropCard: () => void;
  onDragEndCard: () => void;
}

function OrgPageCard({
  view,
  pageNumber,
  badge,
  rotation,
  label,
  dimmed,
  first,
  last,
  busy,
  duplicating,
  t,
  onRotate,
  onMove,
  onToggleDelete,
  onDuplicate,
  onDragStartCard,
  onDropCard,
  onDragEndCard
}: OrgPageCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failedView, setFailedView] = useState<OpenedPdfView | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const failed = failedView !== null && failedView === view;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!view || !canvas) return;
    let cancelled = false;
    view.render(pageNumber, canvas, 200).catch(() => {
      if (!cancelled) setFailedView(view);
    });
    return () => {
      cancelled = true;
    };
  }, [view, pageNumber]);

  const info = view?.pages[pageNumber - 1];
  const vertical = rotation % 180 !== 0;
  const showCanvas = view !== null && !failed && info !== undefined;
  const fit = info && vertical ? Math.min(1, info.width / info.height) : 1;

  return (
    <div
      className={`thumb-card org-card${dimmed ? ' org-card--deleted' : ''}${dragOver ? ' org-card--drag-over' : ''}`}
      draggable={!busy}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(badge));
        event.dataTransfer.effectAllowed = 'move';
        onDragStartCard();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        onDropCard();
      }}
      onDragEnd={() => {
        setDragOver(false);
        onDragEndCard();
      }}
    >
      <span className="thumb-card__badge">{badge}</span>
      {showCanvas && info ? (
        <div
          className="org-canvas-box"
          style={{
            aspectRatio: vertical ? `${info.height} / ${info.width}` : `${info.width} / ${info.height}`
          }}
        >
          <canvas
            ref={canvasRef}
            className="org-canvas"
            style={rotation ? { transform: `rotate(${rotation}deg) scale(${fit})` } : undefined}
            aria-hidden="true"
          />
        </div>
      ) : (
        <span className="org-card-fallback" aria-hidden="true">
          <FileText size={26} />
        </span>
      )}
      <span className="thumb-card__label">{label}</span>
      <div className="thumb-card__actions">
        <button className="ct-icon-button" type="button" aria-label={t.rotateLeft(badge)} disabled={busy} onClick={() => onRotate(270)}>
          <RotateCcw size={14} aria-hidden="true" />
        </button>
        <button className="ct-icon-button" type="button" aria-label={t.rotateRight(badge)} disabled={busy} onClick={() => onRotate(90)}>
          <RotateCw size={14} aria-hidden="true" />
        </button>
        <button className="ct-icon-button" type="button" aria-label={t.moveUp(badge)} disabled={first || busy} onClick={() => onMove(-1)}>
          <ChevronUp size={14} aria-hidden="true" />
        </button>
        <button className="ct-icon-button" type="button" aria-label={t.moveDown(badge)} disabled={last || busy} onClick={() => onMove(1)}>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <button
          className="ct-icon-button org-card-duplicate"
          type="button"
          aria-label={t.duplicate(badge)}
          disabled={busy}
          onClick={onDuplicate}
        >
          {duplicating ? <span className="spinner" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
        <button
          className="ct-icon-button org-card-remove"
          type="button"
          aria-label={dimmed ? t.restore(badge) : t.remove(badge)}
          disabled={busy}
          onClick={onToggleDelete}
        >
          {dimmed ? <Undo2 size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export function OrganizePage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [original, setOriginal] = useState<SourceDoc | null>(null);
  const [source, setSource] = useState<SourceDoc | null>(null);
  const [cards, setCards] = useState<OrgCard[]>([]);
  const [deleted, setDeleted] = useState<ReadonlySet<number>>(new Set());
  const [rotations, setRotations] = useState<Map<number, RotationDegrees>>(new Map());
  const [preview, setPreview] = useState<{ bytes: Uint8Array; view: OpenedPdfView } | null>(null);
  const [loadNotice, setLoadNotice] = useState<string | undefined>(undefined);
  const [opError, setOpError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [dupInFlight, setDupInFlight] = useState<number | null>(null);
  const [blankInFlight, setBlankInFlight] = useState(false);
  const [structureChanged, setStructureChanged] = useState(false);
  const nextIdRef = useRef(0);
  const dragIdRef = useRef<number | null>(null);

  const clearOutcome = useCallback(() => {
    setOpError(null);
    setSaved(null);
  }, []);

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
        setPreview({ bytes: source.bytes, view: openedView });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [source]);

  const view = preview && source && preview.bytes === source.bytes ? preview.view : null;

  const kept = useMemo(() => cards.filter((card) => !deleted.has(card.id)), [cards, deleted]);
  const rotatedCount = useMemo(
    () => kept.reduce((count, card) => count + ((rotations.get(card.id) ?? 0) !== 0 ? 1 : 0), 0),
    [kept, rotations]
  );
  // Duplicated/blank pages keep the src list a contiguous permutation, so structural ops
  // are tracked separately to keep "Apply" enabled.
  const hasEdits =
    deleted.size > 0 || rotatedCount > 0 || structureChanged || kept.some((card, index) => card.src !== index);
  const diverged = Boolean(source && original && source.bytes !== original.bytes);
  const busy = applying || dupInFlight !== null || blankInFlight;
  const canApply = Boolean(source) && hasEdits && !busy;
  const canReset = Boolean(source) && (hasEdits || diverged) && !busy;

  const summary = source
    ? [
        t.pages(kept.length),
        ...(rotatedCount > 0 ? [t.rotated(rotatedCount)] : []),
        ...(deleted.size > 0 ? [t.removed(deleted.size)] : [])
      ].join(' · ')
    : '';

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      clearOutcome();
      if (file.size > MAX_FILE_BYTES) {
        setOriginal(null);
        setSource(null);
        setCards([]);
        setDeleted(new Set());
        setRotations(new Map());
        setStructureChanged(false);
        setLoadNotice(t.oversized);
        return;
      }
      void (async () => {
        try {
          const bytes = new Uint8Array(await readFileBytes(file));
          const pageCount = await getPdfPageCount(bytes);
          const doc: SourceDoc = { bytes, pageCount, name: file.name };
          setOriginal(doc);
          setSource(doc);
          setCards(identityCards(pageCount));
          setDeleted(new Set());
          setRotations(new Map());
          setStructureChanged(false);
          nextIdRef.current = pageCount;
          setLoadNotice(undefined);
        } catch (error) {
          setOriginal(null);
          setSource(null);
          setCards([]);
          setDeleted(new Set());
          setRotations(new Map());
          setStructureChanged(false);
          setLoadNotice(error instanceof EncryptedPdfError ? t.encrypted : t.unreadable);
        }
      })();
    },
    [clearOutcome, t]
  );

  const rotateCard = useCallback(
    (id: number, delta: 90 | 270) => {
      clearOutcome();
      setRotations((prev) => {
        const next = new Map(prev);
        next.set(id, (((next.get(id) ?? 0) + delta) % 360) as RotationDegrees);
        return next;
      });
    },
    [clearOutcome]
  );

  const moveCard = useCallback(
    (position: number, delta: -1 | 1) => {
      clearOutcome();
      setCards((prev) => {
        const target = position + delta;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[position], next[target]] = [next[target], next[position]];
        return next;
      });
    },
    [clearOutcome]
  );

  const toggleDelete = useCallback(
    (id: number) => {
      clearOutcome();
      setDeleted((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [clearOutcome]
  );

  const reverseCards = useCallback(() => {
    clearOutcome();
    setCards((prev) => [...prev].reverse());
  }, [clearOutcome]);

  const handleDuplicate = useCallback(
    async (card: OrgCard) => {
      if (!source || busy) return;
      clearOutcome();
      setDupInFlight(card.id);
      try {
        const work = await duplicatePages(source.bytes, [card.src]);
        const newId = nextIdRef.current;
        nextIdRef.current += 1;
        setSource((prev) => (prev ? { ...prev, bytes: work, pageCount: prev.pageCount + 1 } : prev));
        setCards((prev) => {
          const at = prev.findIndex((item) => item.id === card.id);
          if (at < 0) return prev;
          const next = [...prev];
          next.splice(at + 1, 0, { id: newId, src: card.src + 1 });
          return next.map((item) => {
            if (item.id === newId) return item;
            return item.src > card.src ? { ...item, src: item.src + 1 } : item;
          });
        });
        setDeleted(new Set());
        setRotations(new Map());
        setStructureChanged(true);
      } catch (error) {
        setOpError(error instanceof EncryptedPdfError ? t.encrypted : t.opError);
      } finally {
        setDupInFlight(null);
      }
    },
    [source, busy, clearOutcome, t]
  );

  const handleInsertBlank = useCallback(async () => {
    if (!source || busy) return;
    clearOutcome();
    setBlankInFlight(true);
    try {
      // Chosen behaviour: the blank page goes right after the page the first card currently
      // points at (src + 1), or at index 0 when the grid is empty.
      const insertIndex = (cards[0]?.src ?? -1) + 1;
      const work = await insertBlankPage(source.bytes, insertIndex);
      const newId = nextIdRef.current;
      nextIdRef.current += 1;
      setSource((prev) => (prev ? { ...prev, bytes: work, pageCount: prev.pageCount + 1 } : prev));
      setCards((prev) => {
        const next = prev.map((item) => (item.src >= insertIndex ? { ...item, src: item.src + 1 } : item));
        next.splice(prev.length > 0 ? 1 : 0, 0, { id: newId, src: insertIndex });
        return next;
      });
      setDeleted(new Set());
      setRotations(new Map());
      setStructureChanged(true);
    } catch (error) {
      setOpError(error instanceof EncryptedPdfError ? t.encrypted : t.opError);
    } finally {
      setBlankInFlight(false);
    }
  }, [source, cards, busy, clearOutcome, t]);

  const handleDragStartCard = useCallback((id: number) => {
    dragIdRef.current = id;
  }, []);

  const handleDragEndCard = useCallback(() => {
    dragIdRef.current = null;
  }, []);

  const handleDropCard = useCallback(
    (targetId: number) => {
      const dragId = dragIdRef.current;
      dragIdRef.current = null;
      if (dragId === null || dragId === targetId) return;
      clearOutcome();
      setCards((prev) => {
        const from = prev.findIndex((card) => card.id === dragId);
        if (from < 0 || !prev.some((card) => card.id === targetId)) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        const to = next.findIndex((card) => card.id === targetId);
        next.splice(to, 0, moved);
        return next;
      });
    },
    [clearOutcome]
  );

  const handleApply = useCallback(async () => {
    if (!source || !hasEdits || busy) return;
    clearOutcome();
    setApplying(true);
    try {
      const order = kept.map((card) => card.src);
      const removed = cards
        .filter((card) => deleted.has(card.id))
        .map((card) => card.src)
        .sort((a, b) => a - b);
      let work = source.bytes;
      if (removed.length) work = await removePages(work, removed);
      const remapped = order.map((index) => index - removed.filter((gone) => gone < index).length);
      if (remapped.some((value, position) => value !== position)) work = await reorderPages(work, remapped);
      const mapped = new Map<number, RotationDegrees>();
      kept.forEach((card, position) => {
        const rotation = rotations.get(card.id);
        if (rotation) mapped.set(position, rotation);
      });
      if (mapped.size) work = await rotatePages(work, mapped);
      setSource({ bytes: work, pageCount: kept.length, name: source.name });
      setCards(kept.map((card, position) => ({ id: card.id, src: position })));
      setDeleted(new Set());
      setRotations(new Map());
      setStructureChanged(false);
      setSaved(t.saved(kept.length));
    } catch (error) {
      setOpError(error instanceof EncryptedPdfError ? t.encrypted : t.opError);
    } finally {
      setApplying(false);
    }
  }, [source, hasEdits, busy, kept, cards, deleted, rotations, t, clearOutcome]);

  const handleReset = useCallback(() => {
    if (!original) return;
    clearOutcome();
    setLoadNotice(undefined);
    setSource({ bytes: original.bytes, pageCount: original.pageCount, name: original.name });
    setCards(identityCards(original.pageCount));
    setDeleted(new Set());
    setRotations(new Map());
    setStructureChanged(false);
    nextIdRef.current = original.pageCount;
  }, [original, clearOutcome]);

  const handleDownload = useCallback(() => {
    if (!source) return;
    const base = source.name.replace(/\.pdf$/i, '');
    downloadBytes(source.bytes, withPdfSuffix(`${base}-${vi ? 'sap-xep' : 'organized'}`));
  }, [source, vi]);

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="tool-page-heading tool-page-heading--compact">
        <a className="tool-page-heading__back" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> {t.back}
        </a>
        <span className="ct-eyebrow">
          <LayoutList size={14} aria-hidden="true" /> ClassTools PDF
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </div>

      <div className="pdf-workspace org-workspace">
        <section className="ct-panel panel-section org-panel" aria-label={t.title}>
          <FileDrop compact={source !== null} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={loadNotice} />

          {source && (
            <div className="action-bar org-toolbar">
              <span className="ct-chip org-chip">{summary}</span>
              <button className="ct-button ct-button--soft org-reverse" type="button" disabled={busy} onClick={reverseCards}>
                <ArrowDownUp size={17} aria-hidden="true" />
                {t.reverse}
              </button>
              <button
                className="ct-button ct-button--soft org-blank"
                type="button"
                disabled={busy}
                onClick={() => void handleInsertBlank()}
              >
                {blankInFlight ? <span className="spinner" aria-hidden="true" /> : <FilePlus size={17} aria-hidden="true" />}
                {t.insertBlank}
              </button>
              <button
                className="ct-button ct-button--primary org-apply"
                type="button"
                disabled={!canApply}
                onClick={() => void handleApply()}
              >
                {applying ? <span className="spinner" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
                {applying ? t.applying : t.apply}
              </button>
              <button className="ct-button ct-button--soft org-reset" type="button" disabled={!canReset} onClick={handleReset}>
                {t.reset}
              </button>
            </div>
          )}

          {source && (
            <div className="thumb-grid org-grid">
              {cards.map((card, position) => (
                <OrgPageCard
                  key={card.id}
                  view={view}
                  pageNumber={card.src + 1}
                  badge={card.id + 1}
                  rotation={rotations.get(card.id) ?? 0}
                  label={t.pageLabel(card.id + 1, rotations.get(card.id) ?? 0)}
                  dimmed={deleted.has(card.id)}
                  first={position === 0}
                  last={position === cards.length - 1}
                  busy={busy}
                  duplicating={dupInFlight === card.id}
                  t={t}
                  onRotate={(delta) => rotateCard(card.id, delta)}
                  onMove={(delta) => moveCard(position, delta)}
                  onToggleDelete={() => toggleDelete(card.id)}
                  onDuplicate={() => void handleDuplicate(card)}
                  onDragStartCard={() => handleDragStartCard(card.id)}
                  onDropCard={() => handleDropCard(card.id)}
                  onDragEndCard={handleDragEndCard}
                />
              ))}
            </div>
          )}

          {!source && <p className="thumb-empty">{t.emptyHint}</p>}

          {opError && (
            <p className="notice" role="alert">
              {opError}
            </p>
          )}

          {saved && (
            <div className="notice notice--ok org-saved" role="status">
              <span>{saved}</span>
              <button className="ct-button ct-button--accent" type="button" onClick={handleDownload}>
                <Download size={16} aria-hidden="true" />
                {t.download}
              </button>
            </div>
          )}
        </section>
      </div>
    </ToolShell>
  );
}
