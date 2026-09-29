import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, LayoutList, Type } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, readFileBytes } from '../lib/download';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import { extractText, textFileName } from '../lib/pdfText';
import type { ExtractedText } from '../lib/pdfText';
import './extract-text.css';

type ViewMode = 'full' | 'page';

interface SourceDoc {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

interface ExtractStrings {
  title: string;
  dropLabel: string;
  dropHint: string;
  emptyHint: string;
  pages: (count: number) => string;
  encrypted: string;
  unreadable: (name: string) => string;
  extractAction: string;
  extracting: string;
  viewLabel: string;
  viewFull: string;
  viewPages: string;
  resultAria: string;
  pageSelectLabel: string;
  pageOption: (page: number) => string;
  charCount: (count: number) => string;
  copy: string;
  copied: string;
  copyError: string;
  downloadTxt: string;
  noText: string;
  opError: string;
}

const STRINGS: Record<'vi' | 'en', ExtractStrings> = {
  vi: {
    title: 'Trích xuất chữ',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    emptyHint: 'Tải lên một tệp PDF để bắt đầu trích xuất chữ.',
    pages: (count) => `${count} trang`,
    encrypted: 'Tệp được bảo vệ bằng mật khẩu nên không thể trích xuất chữ.',
    unreadable: (name) => `Không đọc được tệp: ${name}. Tệp có thể bị hỏng hoặc không phải PDF.`,
    extractAction: 'Trích xuất chữ',
    extracting: 'Đang trích xuất…',
    viewLabel: 'Cách xem kết quả',
    viewFull: 'Toàn bộ',
    viewPages: 'Theo trang',
    resultAria: 'Kết quả',
    pageSelectLabel: 'Chọn trang',
    pageOption: (page) => `Trang ${page}`,
    charCount: (count) => `${count} ký tự`,
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    copyError: 'Trình duyệt không cho phép sao chép tự động. Hãy chọn văn bản và sao chép thủ công.',
    downloadTxt: 'Tải tệp .txt',
    noText: 'PDF này không có chữ có thể trích xuất.',
    opError: 'Không thể trích xuất chữ từ tệp này. Tệp có thể bị hỏng hoặc không đúng chuẩn.'
  },
  en: {
    title: 'Extract Text',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    emptyHint: 'Upload a PDF file to start extracting text.',
    pages: (count) => `${count} pages`,
    encrypted: 'This file is password protected, so its text cannot be extracted.',
    unreadable: (name) => `Could not read file: ${name}. It may be corrupted or not a PDF.`,
    extractAction: 'Extract text',
    extracting: 'Extracting…',
    viewLabel: 'Result view',
    viewFull: 'Full text',
    viewPages: 'By page',
    resultAria: 'Result',
    pageSelectLabel: 'Choose page',
    pageOption: (page) => `Page ${page}`,
    charCount: (count) => `${count} chars`,
    copy: 'Copy',
    copied: 'Copied',
    copyError: 'The browser blocked automatic copying. Select the text and copy it manually.',
    downloadTxt: 'Download .txt',
    noText: 'This PDF has no text that can be extracted.',
    opError: 'Could not extract text from this file. It may be corrupted or not a valid PDF.'
  }
};

export function ExtractTextPage() {
  const { locale } = usePreferences();
  const t = STRINGS[locale];

  const [source, setSource] = useState<SourceDoc | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractedText | null>(null);
  const [view, setView] = useState<ViewMode>('full');
  const [selectedPage, setSelectedPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const outputRef = useRef<HTMLTextAreaElement | null>(null);
  const copiedTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    []
  );

  const clearOutcome = useCallback(() => {
    setResult(null);
    setOpError(null);
    setCopied(false);
  }, []);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      clearOutcome();
      setNotice(undefined);
      setView('full');
      setSelectedPage(1);
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

  const handleExtract = useCallback(async () => {
    if (!source) return;
    clearOutcome();
    setBusy(true);
    try {
      const extracted = await extractText(source.bytes);
      setResult(extracted);
      setView('full');
      setSelectedPage(1);
    } catch {
      setOpError(t.opError);
    } finally {
      setBusy(false);
    }
  }, [source, clearOutcome, t]);

  const currentText = result ? (view === 'full' ? result.fullText : (result.pages[selectedPage - 1]?.text ?? '')) : '';

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentText);
      } else {
        const area = outputRef.current;
        if (!area) throw new Error('NO_OUTPUT');
        area.focus();
        area.select();
        if (!document.execCommand('copy')) throw new Error('COPY_REJECTED');
      }
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
      setOpError(t.copyError);
    }
  }, [result, currentText, t]);

  const handleDownload = useCallback(() => {
    if (!source || !result) return;
    downloadBytes(new TextEncoder().encode(result.fullText), textFileName(source.file.name), 'text/plain;charset=utf-8');
  }, [source, result]);

  const hasText = Boolean(result && result.pages.some((page) => page.text.trim()));

  return (
    <ToolShell>

      <div className="pdf-workspace pdf-workspace--side xt-workspace">
        <section className="ct-panel panel-section xt-source" aria-label={t.dropLabel}>
          <FileDrop compact={source !== null} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {source && (
            <div className="xt-source__info">
              <span className="xt-source__name">{fileSummary(source.file)}</span>
              <span className="ct-chip xt-chip">
                <FileText size={13} aria-hidden="true" />
                {t.pages(source.pageCount)}
              </span>
            </div>
          )}
        </section>

        <section className="ct-panel panel-section xt-main" aria-label={t.title}>
          {source ? (
            <>
              <div className="action-bar">
                <button
                  type="button"
                  className="ct-button ct-button--primary xt-extract"
                  disabled={busy}
                  onClick={() => void handleExtract()}
                >
                  {busy ? <span className="spinner" aria-hidden="true" /> : <Type size={17} aria-hidden="true" />}
                  {busy ? t.extracting : t.extractAction}
                </button>
              </div>

              {result && hasText && (
                <>
                  <div className="xt-toggle" role="group" aria-label={t.viewLabel}>
                    <button
                      type="button"
                      className={`xt-toggle-btn${view === 'full' ? ' is-active' : ''}`}
                      aria-pressed={view === 'full'}
                      onClick={() => setView('full')}
                    >
                      <FileText size={15} aria-hidden="true" /> {t.viewFull}
                    </button>
                    <button
                      type="button"
                      className={`xt-toggle-btn${view === 'page' ? ' is-active' : ''}`}
                      aria-pressed={view === 'page'}
                      onClick={() => setView('page')}
                    >
                      <LayoutList size={15} aria-hidden="true" /> {t.viewPages}
                    </button>
                  </div>

                  {view === 'full' ? (
                    <textarea ref={outputRef} className="xt-output" readOnly value={result.fullText} aria-label={t.resultAria} />
                  ) : (
                    <div className="xt-page-view">
                      <label className="field">
                        <span>{t.pageSelectLabel}</span>
                        <select
                          value={selectedPage}
                          aria-label={t.pageSelectLabel}
                          onChange={(event) => setSelectedPage(Number(event.target.value))}
                        >
                          {result.pages.map((page) => (
                            <option key={page.pageNumber} value={page.pageNumber}>
                              {t.pageOption(page.pageNumber)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="xt-chips">
                        {result.pages.map((page) => (
                          <button
                            key={page.pageNumber}
                            type="button"
                            className={`xt-page-chip${page.pageNumber === selectedPage ? ' is-active' : ''}`}
                            aria-pressed={page.pageNumber === selectedPage}
                            onClick={() => setSelectedPage(page.pageNumber)}
                          >
                            {t.pageOption(page.pageNumber)} · {t.charCount(page.text.length)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        ref={outputRef}
                        className="xt-output"
                        readOnly
                        value={result.pages[selectedPage - 1]?.text ?? ''}
                        aria-label={t.resultAria}
                      />
                    </div>
                  )}

                  <div className="action-bar">
                    <button type="button" className="ct-button ct-button--soft" onClick={() => void handleCopy()}>
                      <Copy size={16} aria-hidden="true" />
                      {t.copy}
                    </button>
                    <button type="button" className="ct-button ct-button--accent" onClick={handleDownload}>
                      <Download size={16} aria-hidden="true" />
                      {t.downloadTxt}
                    </button>
                    {copied && (
                      <span className="ct-chip xt-copied" role="status">
                        <Check size={13} aria-hidden="true" />
                        {t.copied}
                      </span>
                    )}
                  </div>
                </>
              )}

              {result && !hasText && (
                <p className="xt-empty" role="status">
                  {t.noText}
                </p>
              )}

              {opError && (
                <p className="notice" role="alert">
                  {opError}
                </p>
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
