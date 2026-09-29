import { useCallback, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Combine, FileText, Trash2 } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ResultCard } from '../components/ResultCard';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { EncryptedPdfError, getPdfPageCount, mergePdfs } from '../lib/pdfOps';
import './merge.css';

const MAX_FILE_BYTES = 100 * 1024 * 1024;

interface MergeEntry {
  id: number;
  file: File;
  bytes: Uint8Array;
  /** -1 while the page count is still being read. */
  pages: number;
}

interface MergeStrings {
  back: string;
  title: string;
  description: string;
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
  oversized: (names: string[]) => string;
}

const STRINGS: Record<'vi' | 'en', MergeStrings> = {
  vi: {
    back: 'Trang chủ',
    title: 'Ghép PDF',
    description: 'Gộp nhiều tệp PDF thành một, đổi thứ tự trước khi ghép. Mọi thao tác chạy ngay trên thiết bị của bạn.',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Thêm từ 2 tệp trở lên để ghép',
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
    unreadable: (names) => `Không đọc được tệp: ${names.join(', ')}.`,
    oversized: (names) => `Bỏ qua tệp quá 100 MB: ${names.join(', ')}.`
  },
  en: {
    back: 'Home',
    title: 'Merge PDF',
    description: 'Combine multiple PDFs into one and reorder files before merging. Everything runs on your device.',
    dropLabel: 'Drop or choose PDF files',
    dropHint: 'Add at least 2 files to merge',
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
    unreadable: (names) => `Could not read files: ${names.join(', ')}.`,
    oversized: (names) => `Skipped files over 100 MB: ${names.join(', ')}.`
  }
};

function buildNotice(parts: string[]): string | undefined {
  return parts.length ? parts.join(' ') : undefined;
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });
}

export function MergePage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
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
      const oversized: string[] = [];
      const encrypted: string[] = [];
      const unreadable: string[] = [];
      clearOutcome();
      void (async () => {
        for (const file of incoming) {
          if (file.size > MAX_FILE_BYTES) {
            oversized.push(file.name);
            continue;
          }
          idRef.current += 1;
          const id = idRef.current;
          setEntries((prev) => [...prev, { id, file, bytes: new Uint8Array(), pages: -1 }]);
          try {
            const bytes = new Uint8Array(await readFileBytes(file));
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
            ...(oversized.length ? [t.oversized(oversized)] : []),
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
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="tool-page-heading tool-page-heading--compact">
        <a className="tool-page-heading__back" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> {t.back}
        </a>
        <span className="ct-eyebrow">
          <Combine size={14} aria-hidden="true" /> ClassTools PDF
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </div>

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
            <FileDrop multiple compact={entries.length > 0} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

            {entries.length > 0 && (
              <ul className="file-list merge-file-list">
                {entries.map((entry, index) => (
                  <li key={entry.id}>
                    <span className="file-list__name">{fileSummary(entry.file)}</span>
                    {entry.pages >= 0 ? (
                      <span className="ct-chip merge-chip">
                        <FileText size={13} aria-hidden="true" />
                        {t.pages(entry.pages)}
                      </span>
                    ) : (
                      <span className="ct-chip merge-chip merge-chip--pending">…</span>
                    )}
                    <span className="merge-row-actions">
                      <button
                        className="ct-icon-button"
                        type="button"
                        aria-label={t.moveUp(entry.file.name)}
                        disabled={index === 0}
                        onClick={() => moveEntry(index, -1)}
                      >
                        <ChevronUp size={15} aria-hidden="true" />
                      </button>
                      <button
                        className="ct-icon-button"
                        type="button"
                        aria-label={t.moveDown(entry.file.name)}
                        disabled={index === entries.length - 1}
                        onClick={() => moveEntry(index, 1)}
                      >
                        <ChevronDown size={15} aria-hidden="true" />
                      </button>
                      <button
                        className="ct-icon-button merge-remove"
                        type="button"
                        aria-label={t.remove(entry.file.name)}
                        onClick={() => removeEntry(entry.id)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
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
