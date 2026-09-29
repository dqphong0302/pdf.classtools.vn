import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Combine, Trash2 } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { PdfThumb } from '../components/PdfThumb';
import { ResultCard } from '../components/ResultCard';
import { SortableCard, SortableCards } from '../components/SortableCards';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, formatBytes, readFileBytes, withPdfSuffix } from '../lib/download';
import { EncryptedPdfError, getPdfPageCount, mergePdfs } from '../lib/pdfOps';
import { imagesToPdf } from '../lib/pdfImages';
import './merge.css';

const IMAGE_PATTERN = /\.(png|jpe?g)$/i;

interface MergeEntry {
  id: number;
  file: File;
  bytes: Uint8Array;
  /** -1 while the page count is still being read. */
  pages: number;
}

interface MergeStrings {
  title: string;
  dropLabel: string;
  dropHint: string;
  pages: (count: number) => string;
  moveUp: (name: string) => string;
  moveDown: (name: string) => string;
  remove: (name: string) => string;
  outputLabel: string;
  outputAria: string;
  mergeAction: string;
  merging: string;
  fileCount: (count: number) => string;
  resultText: (count: number) => string;
  download: string;
  mergeError: string;
  encrypted: (names: string[]) => string;
  unreadable: (names: string[]) => string;
}

const STRINGS: Record<'vi' | 'en', MergeStrings> = {
  vi: {
    title: 'Ghép PDF',
    dropLabel: 'Chọn tệp PDF hoặc ảnh',
    dropHint: 'PDF, JPG, PNG · từ 2 tệp trở lên',
    pages: (count) => `${count} trang`,
    moveUp: (name) => `Di chuyển ${name} lên trên`,
    moveDown: (name) => `Di chuyển ${name} xuống dưới`,
    remove: (name) => `Xóa ${name}`,
    outputLabel: 'Tên tệp kết quả',
    outputAria: 'Tên tệp kết quả',
    mergeAction: 'Ghép PDF',
    merging: 'Đang ghép…',
    fileCount: (count) => `${count} tệp`,
    resultText: (count) => `Đã ghép ${count} trang thành một tệp duy nhất.`,
    download: 'Tải xuống',
    mergeError: 'Không thể ghép các tệp này. Tệp PDF có thể bị hỏng hoặc không đúng chuẩn.',
    encrypted: (names) => `Tệp được bảo vệ bằng mật khẩu nên không thể xử lý: ${names.join(', ')}.`,
    unreadable: (names) => `Không đọc được tệp: ${names.join(', ')}.`
  },
  en: {
    title: 'Merge PDF',
    dropLabel: 'Choose PDF or image files',
    dropHint: 'PDF, JPG, PNG · 2 files or more',
    pages: (count) => `${count} pages`,
    moveUp: (name) => `Move ${name} up`,
    moveDown: (name) => `Move ${name} down`,
    remove: (name) => `Remove ${name}`,
    outputLabel: 'Output file name',
    outputAria: 'Output file name',
    mergeAction: 'Merge PDF',
    merging: 'Merging…',
    fileCount: (count) => `${count} files`,
    resultText: (count) => `Merged ${count} pages into a single file.`,
    download: 'Download',
    mergeError: 'Could not merge these files. A PDF may be corrupted or not a valid PDF.',
    encrypted: (names) => `Password protected files cannot be processed: ${names.join(', ')}.`,
    unreadable: (names) => `Could not read files: ${names.join(', ')}.`
  }
};

function buildNotice(parts: string[]): string | undefined {
  return parts.length ? parts.join(' ') : undefined;
}

export function MergePage() {
  const { locale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [entries, setEntries] = useState<MergeEntry[]>([]);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; pages: number } | null>(null);
  const idRef = useRef(0);

  const outputName = vi ? 'ghep' : 'merged';
  const allLoaded = entries.every((entry) => entry.pages >= 0);
  const canMerge = entries.length >= 2 && allLoaded && !merging;
  const clearOutcome = useCallback(() => {
    setResult(null);
    setMergeError(null);
  }, []);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const encrypted: string[] = [];
      const unreadable: string[] = [];
      clearOutcome();
      void (async () => {
        for (const file of incoming) {
          idRef.current += 1;
          const id = idRef.current;
          setEntries((prev) => [...prev, { id, file, bytes: new Uint8Array(), pages: -1 }]);
          try {
            const raw = new Uint8Array(await readFileBytes(file));
            // Images become a one-page A4 PDF so they merge like any other document.
            const bytes = IMAGE_PATTERN.test(file.name) || file.type.startsWith('image/')
              ? await imagesToPdf([raw], { pageSize: 'a4', orientation: 'auto', marginMm: 0 })
              : raw;
            const pages = await getPdfPageCount(bytes);
            setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, bytes, pages } : entry)));
          } catch (error) {
            setEntries((prev) => prev.filter((entry) => entry.id !== id));
            if (error instanceof EncryptedPdfError) encrypted.push(file.name);
            else unreadable.push(file.name);
          }
        }
        setNotice(
          buildNotice([
            ...(encrypted.length ? [t.encrypted(encrypted)] : []),
            ...(unreadable.length ? [t.unreadable(unreadable)] : [])
          ])
        );
      })();
    },
    [clearOutcome, t]
  );

  const moveEntry = useCallback(
    (index: number, delta: number) => {
      clearOutcome();
      setEntries((prev) => {
        const target = index + delta;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    },
    [clearOutcome]
  );

  const reorderEntries = useCallback(
    (nextIds: (string | number)[]) => {
      clearOutcome();
      setEntries((prev) => nextIds.map((id) => prev.find((entry) => entry.id === id)).filter((entry): entry is MergeEntry => Boolean(entry)));
    },
    [clearOutcome]
  );

  const removeEntry = useCallback(
    (id: number) => {
      clearOutcome();
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    },
    [clearOutcome]
  );

  const handleMerge = useCallback(async () => {
    if (!canMerge) return;
    setMerging(true);
    setMergeError(null);
    setResult(null);
    try {
      const merged = await mergePdfs(entries.map((entry) => entry.bytes));
      const pages = await getPdfPageCount(merged);
      setResult({ bytes: merged, pages });
    } catch {
      setMergeError(t.mergeError);
    } finally {
      setMerging(false);
    }
  }, [canMerge, entries, t]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBytes(result.bytes, withPdfSuffix(outputName));
  }, [result, outputName]);

  return (
    <ToolShell>

      <div className="flow merge-workspace">
        {result ? (
          <ResultCard
            vi={vi}
            message={t.resultText(result.pages)}
            onDownload={handleDownload}
            onReset={() => {
              setEntries([]);
              setNotice(undefined);
              clearOutcome();
            }}
          />
        ) : (
          <section className="ct-panel panel-section merge-panel" aria-label={t.title}>
            <FileDrop
              multiple
              compact={entries.length > 0}
              label={t.dropLabel}
              hint={t.dropHint}
              accept="application/pdf,.pdf,image/png,image/jpeg"
              acceptPattern={/\.(pdf|png|jpe?g)$/i}
              formatLabel="PDF · JPG · PNG"
              onFiles={handleFiles}
              notice={notice}
            />

            {entries.length > 0 && (
              <SortableCards ids={entries.map((entry) => entry.id)} label={vi ? 'Danh sách tệp' : 'Files'} onReorder={reorderEntries}>
                {entries.map((entry, index) => (
                  <SortableCard key={entry.id} id={entry.id}>
                    <span className="file-card__index">{index + 1}</span>
                    <button
                      className="file-card__remove"
                      type="button"
                      aria-label={t.remove(entry.file.name)}
                      onClick={() => removeEntry(entry.id)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                    <div className="file-card__thumb">
                      <PdfThumb bytes={entry.bytes} />
                    </div>
                    <div className="file-card__meta">
                      <span className="file-card__name" title={entry.file.name}>{entry.file.name}</span>
                      <span className="file-card__sub">
                        {entry.pages < 0 ? '…' : IMAGE_PATTERN.test(entry.file.name) ? `${vi ? 'Ảnh' : 'Image'} · ${formatBytes(entry.file.size)}` : `${t.pages(entry.pages)} · ${formatBytes(entry.file.size)}`}
                      </span>
                      <span className="file-card__move">
                        <button
                          className="ct-icon-button"
                          type="button"
                          aria-label={t.moveUp(entry.file.name)}
                          disabled={index === 0}
                          onClick={() => moveEntry(index, -1)}
                        >
                          <ChevronLeft size={15} aria-hidden="true" />
                        </button>
                        <button
                          className="ct-icon-button"
                          type="button"
                          aria-label={t.moveDown(entry.file.name)}
                          disabled={index === entries.length - 1}
                          onClick={() => moveEntry(index, 1)}
                        >
                          <ChevronRight size={15} aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  </SortableCard>
                ))}
              </SortableCards>
            )}
            {entries.length > 1 && (
              <p className="file-cards__hint">{vi ? 'Kéo thả các tệp để đổi thứ tự ghép.' : 'Drag files to change the merge order.'}</p>
            )}

            {entries.length > 0 && !allLoaded && <p className="merge-loading">{vi ? 'Đang đọc tệp…' : 'Reading files…'}</p>}
            {entries.length === 1 && allLoaded && (
              <p className="flow-hint">{vi ? 'Thêm ít nhất một tệp nữa để ghép.' : 'Add at least one more file to merge.'}</p>
            )}

            {mergeError && (
              <p className="notice" role="alert">
                {mergeError}
              </p>
            )}

            {entries.length > 0 && (
              <div className="action-bar flow-actions">
                <button className="primary-action" type="button" disabled={!canMerge} onClick={handleMerge}>
                  {merging ? <span className="spinner" aria-hidden="true" /> : <Combine size={19} aria-hidden="true" />}
                  {merging ? t.merging : vi ? `Ghép ${entries.length} tệp` : `Merge ${entries.length} files`}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </ToolShell>
  );
}
