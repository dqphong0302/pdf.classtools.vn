import { useCallback, useState } from 'react';
import { ArrowLeft, Download, Eraser, FileText, Save, Tags } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { clearMetadata, formatKeywords, readMetadata, writeMetadata } from '../lib/pdfMeta';
import type { PdfMetadata, PdfMetadataDraft } from '../lib/pdfMeta';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import './metadata.css';

const MAX_FILE_BYTES = 100 * 1024 * 1024;

interface SourceDoc {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
  meta: PdfMetadata;
}

interface MetadataStrings {
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
  infoHeading: string;
  infoHint: string;
  created: string;
  modified: string;
  producer: string;
  creator: string;
  titleLabel: string;
  authorLabel: string;
  subjectLabel: string;
  keywordsLabel: string;
  keywordsHint: string;
  saveAction: string;
  saving: string;
  clearAction: string;
  clearing: string;
  savedNotice: string;
  clearedNotice: string;
  download: string;
  opError: string;
}

const STRINGS: Record<'vi' | 'en', MetadataStrings> = {
  vi: {
    back: 'Trang chủ',
    title: 'Metadata PDF',
    description:
      'Xem và sửa thông tin tài liệu PDF: tiêu đề, tác giả, chủ đề, từ khóa. Xóa metadata hoặc tải về tệp mới. Mọi thao tác chạy ngay trên thiết bị của bạn.',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    emptyHint: 'Tải lên một tệp PDF để xem và chỉnh sửa metadata.',
    pages: (count) => `${count} trang`,
    oversized: (name) => `Bỏ qua tệp quá 100 MB: ${name}.`,
    encrypted: 'Tệp được bảo vệ bằng mật khẩu nên không thể đọc metadata.',
    unreadable: (name) => `Không đọc được tệp: ${name}. Tệp có thể bị hỏng hoặc không phải PDF.`,
    infoHeading: 'Thông tin chỉ đọc',
    infoHint: 'Các trường này do tệp PDF lưu sẵn, không sửa được ở đây.',
    created: 'Ngày tạo',
    modified: 'Ngày sửa',
    producer: 'Producer',
    creator: 'Creator',
    titleLabel: 'Tiêu đề',
    authorLabel: 'Tác giả',
    subjectLabel: 'Chủ đề',
    keywordsLabel: 'Từ khóa',
    keywordsHint: 'Phân tách bằng dấu phẩy',
    saveAction: 'Lưu metadata',
    saving: 'Đang lưu…',
    clearAction: 'Xóa metadata',
    clearing: 'Đang xóa…',
    savedNotice: 'Đã lưu metadata vào tệp PDF.',
    clearedNotice: 'Đã xóa metadata khỏi tệp PDF.',
    download: 'Tải xuống',
    opError: 'Không thể xử lý tệp PDF này. Tệp có thể bị hỏng hoặc không đúng chuẩn.'
  },
  en: {
    back: 'Home',
    title: 'PDF Metadata',
    description:
      'View and edit PDF document info: title, author, subject, keywords. Clear the metadata or download a new file. Everything runs on your device.',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    emptyHint: 'Upload a PDF file to view and edit its metadata.',
    pages: (count) => `${count} pages`,
    oversized: (name) => `Skipped file over 100 MB: ${name}.`,
    encrypted: 'This file is password protected, so its metadata cannot be read.',
    unreadable: (name) => `Could not read file: ${name}. It may be corrupted or not a PDF.`,
    infoHeading: 'Read-only info',
    infoHint: 'These fields are stored in the PDF and cannot be edited here.',
    created: 'Created',
    modified: 'Modified',
    producer: 'Producer',
    creator: 'Creator',
    titleLabel: 'Title',
    authorLabel: 'Author',
    subjectLabel: 'Subject',
    keywordsLabel: 'Keywords',
    keywordsHint: 'Separate with commas',
    saveAction: 'Save metadata',
    saving: 'Saving…',
    clearAction: 'Clear metadata',
    clearing: 'Clearing…',
    savedNotice: 'Metadata saved into the PDF file.',
    clearedNotice: 'Metadata removed from the PDF file.',
    download: 'Download',
    opError: 'Could not process this PDF. The file may be corrupted or not a valid PDF.'
  }
};

const EMPTY_DRAFT: PdfMetadataDraft = { title: '', author: '', subject: '', keywords: '' };

function draftFromMeta(meta: PdfMetadata): PdfMetadataDraft {
  return {
    title: meta.title,
    author: meta.author,
    subject: meta.subject,
    keywords: formatKeywords(meta.keywords)
  };
}

function draftsEqual(a: PdfMetadataDraft, b: PdfMetadataDraft): boolean {
  return a.title === b.title && a.author === b.author && a.subject === b.subject && a.keywords === b.keywords;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function readFileBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'));
    reader.readAsArrayBuffer(file);
  });
}

export function MetadataPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const t = STRINGS[locale];

  const [source, setSource] = useState<SourceDoc | null>(null);
  const [draft, setDraft] = useState<PdfMetadataDraft>(EMPTY_DRAFT);
  const [initial, setInitial] = useState<PdfMetadataDraft>(EMPTY_DRAFT);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | null>(null);
  const [outcomeBytes, setOutcomeBytes] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const dirty = !draftsEqual(draft, initial);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      setNotice(undefined);
      setStatus(null);
      setOutcomeBytes(null);
      setOpError(null);
      if (file.size > MAX_FILE_BYTES) {
        setSource(null);
        setNotice(t.oversized(file.name));
        return;
      }
      void (async () => {
        try {
          const bytes = new Uint8Array(await readFileBytes(file));
          const [pageCount, meta] = await Promise.all([getPdfPageCount(bytes), readMetadata(bytes)]);
          const nextDraft = draftFromMeta(meta);
          setSource({ file, bytes, pageCount, meta });
          setDraft(nextDraft);
          setInitial(nextDraft);
        } catch (error) {
          setSource(null);
          setNotice(error instanceof EncryptedPdfError ? t.encrypted : t.unreadable(file.name));
        }
      })();
    },
    [t]
  );

  const handleSave = useCallback(async () => {
    if (!source || !dirty || busy) return;
    setBusy('save');
    setStatus(null);
    setOutcomeBytes(null);
    setOpError(null);
    try {
      const saved = await writeMetadata(source.bytes, draft);
      setSource((prev) => (prev ? { ...prev, bytes: saved } : prev));
      setInitial(draft);
      setOutcomeBytes(saved);
      setStatus(t.savedNotice);
    } catch {
      setOpError(t.opError);
    } finally {
      setBusy(null);
    }
  }, [source, dirty, busy, draft, t]);

  const handleClear = useCallback(async () => {
    if (!source || busy) return;
    setBusy('clear');
    setStatus(null);
    setOutcomeBytes(null);
    setOpError(null);
    try {
      const cleared = await clearMetadata(source.bytes);
      setSource((prev) => (prev ? { ...prev, bytes: cleared } : prev));
      setDraft(EMPTY_DRAFT);
      setInitial(EMPTY_DRAFT);
      setOutcomeBytes(cleared);
      setStatus(t.clearedNotice);
    } catch {
      setOpError(t.opError);
    } finally {
      setBusy(null);
    }
  }, [source, busy, t]);

  const downloadName = source ? withPdfSuffix(`${source.file.name.replace(/\.pdf$/i, '')}-metadata`) : '';

  const handleDownload = useCallback(() => {
    if (!outcomeBytes) return;
    downloadBytes(outcomeBytes, downloadName);
  }, [outcomeBytes, downloadName]);

  const setField = (key: keyof PdfMetadataDraft) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="tool-page-heading tool-page-heading--compact">
        <a className="tool-page-heading__back" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> {t.back}
        </a>
        <span className="ct-eyebrow">
          <Tags size={14} aria-hidden="true" /> ClassTools PDF
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </div>

      <div className="pdf-workspace pdf-workspace--side meta-workspace">
        <section className="ct-panel panel-section meta-source" aria-label={t.dropLabel}>
          <FileDrop label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {source && (
            <>
              <div className="meta-source__info">
                <span className="meta-source__name">{fileSummary(source.file)}</span>
                <span className="ct-chip meta-chip">
                  <FileText size={13} aria-hidden="true" />
                  {t.pages(source.pageCount)}
                </span>
              </div>

              <div className="meta-info-block">
                <div className="meta-info-head">
                  <h2>{t.infoHeading}</h2>
                  <p>{t.infoHint}</p>
                </div>
                <ul className="meta-info">
                  <li>
                    <span className="meta-info__label">{t.created}</span>
                    <span className="meta-info__value">{formatDate(source.meta.createdAt)}</span>
                  </li>
                  <li>
                    <span className="meta-info__label">{t.modified}</span>
                    <span className="meta-info__value">{formatDate(source.meta.modifiedAt)}</span>
                  </li>
                  <li>
                    <span className="meta-info__label">{t.producer}</span>
                    <span className="meta-info__value">{source.meta.producer || '—'}</span>
                  </li>
                  <li>
                    <span className="meta-info__label">{t.creator}</span>
                    <span className="meta-info__value">{source.meta.creator || '—'}</span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </section>

        <section className="ct-panel panel-section meta-form-panel" aria-label={t.title}>
          {source ? (
            <>
              <label className="field">
                <span>{t.titleLabel}</span>
                <input
                  type="text"
                  value={draft.title}
                  aria-label={t.titleLabel}
                  onChange={(event) => setField('title')(event.target.value)}
                />
              </label>
              <label className="field">
                <span>{t.authorLabel}</span>
                <input
                  type="text"
                  value={draft.author}
                  aria-label={t.authorLabel}
                  onChange={(event) => setField('author')(event.target.value)}
                />
              </label>
              <label className="field">
                <span>{t.subjectLabel}</span>
                <input
                  type="text"
                  value={draft.subject}
                  aria-label={t.subjectLabel}
                  onChange={(event) => setField('subject')(event.target.value)}
                />
              </label>
              <label className="field">
                <span>
                  {t.keywordsLabel} <em className="meta-keywords-hint">({t.keywordsHint})</em>
                </span>
                <input
                  type="text"
                  value={draft.keywords}
                  aria-label={t.keywordsLabel}
                  onChange={(event) => setField('keywords')(event.target.value)}
                />
              </label>

              <div className="action-bar meta-actions">
                <button
                  type="button"
                  className="ct-button ct-button--primary meta-save"
                  disabled={!dirty || busy !== null}
                  onClick={() => void handleSave()}
                >
                  {busy === 'save' ? <span className="spinner" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                  {busy === 'save' ? t.saving : t.saveAction}
                </button>
                <button
                  type="button"
                  className="ct-button ct-button--soft meta-clear"
                  disabled={busy !== null}
                  onClick={() => void handleClear()}
                >
                  {busy === 'clear' ? <span className="spinner" aria-hidden="true" /> : <Eraser size={17} aria-hidden="true" />}
                  {busy === 'clear' ? t.clearing : t.clearAction}
                </button>
              </div>

              {opError && (
                <p className="notice" role="alert">
                  {opError}
                </p>
              )}

              {status && (
                <div className="notice notice--ok meta-status" role="status">
                  <span>{status}</span>
                  <button type="button" className="ct-button ct-button--accent" onClick={handleDownload}>
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
