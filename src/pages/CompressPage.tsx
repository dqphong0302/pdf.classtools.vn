import { useCallback, useState } from 'react';
import { BookOpen, Download, FileText, HardDrive, Minimize2, Printer, Smartphone } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, formatBytes, readFileBytes, withPdfSuffix } from '../lib/download';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import { compressPdf, type CompressionPreset, type CompressionResult } from '../lib/wasmGhostscript';
import './compress.css';

interface SourceFile {
  file: File;
  bytes: Uint8Array;
  pages: number;
}

interface CompressStrings {
  title: string;
  dropLabel: string;
  dropHint: string;
  presetLabel: string;
  presetTitle: Record<CompressionPreset, string>;
  presetHint: Record<CompressionPreset, string>;
  pages: (count: number) => string;
  reading: string;
  compressAction: string;
  compressing: string;
  firstRunNote: string;
  resultReady: string;
  saved: (percent: number) => string;
  download: string;
  cannotShrink: string;
  compressError: string;
  encrypted: string;
  unreadable: string;
}

const STRINGS: Record<'vi' | 'en', CompressStrings> = {
  vi: {
    title: 'Nén PDF',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Chỉ cần một tệp PDF',
    presetLabel: 'Mức nén',
    presetTitle: {
      printer: 'Chất lượng cao (300dpi)',
      ebook: 'Cân bằng (150dpi)',
      screen: 'Nhỏ nhất (72dpi)'
    },
    presetHint: {
      printer: 'Chất lượng cao',
      ebook: 'Cân bằng',
      screen: 'Nhỏ nhất'
    },
    pages: (count) => `${count} trang`,
    reading: 'Đang đọc tệp…',
    compressAction: 'Nén PDF',
    compressing: 'Đang nén…',
    firstRunNote: 'Lần đầu sử dụng sẽ tải bộ nén (~15 MB) — chờ một lúc nhé.',
    resultReady: 'Tệp đã được nén.',
    saved: (percent) => `Đã tiết kiệm ${percent}%`,
    download: 'Tải xuống',
    cannotShrink: 'Tệp này không thể nén thêm (kết quả lớn hơn). Tải bản gốc.',
    compressError: 'Không thể nén tệp này. Tệp PDF có thể bị hỏng hoặc không đúng chuẩn.',
    encrypted: 'Tệp được bảo vệ bằng mật khẩu nên không thể nén. Hãy mở khóa tệp trước.',
    unreadable: 'Không đọc được tệp này. Tệp PDF có thể bị hỏng hoặc không đúng chuẩn.',
  },
  en: {
    title: 'Compress PDF',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF is enough',
    presetLabel: 'Compression level',
    presetTitle: {
      printer: 'High quality (300dpi)',
      ebook: 'Balanced (150dpi)',
      screen: 'Smallest (72dpi)'
    },
    presetHint: {
      printer: 'High quality',
      ebook: 'Balanced',
      screen: 'Smallest'
    },
    pages: (count) => `${count} pages`,
    reading: 'Reading file…',
    compressAction: 'Compress PDF',
    compressing: 'Compressing…',
    firstRunNote: 'First use downloads the compressor (~15 MB) — please wait a moment.',
    resultReady: 'Compression complete.',
    saved: (percent) => `Saved ${percent}%`,
    download: 'Download',
    cannotShrink: 'This file cannot be compressed further (the result is larger). Download the original.',
    compressError: 'Could not compress this file. The PDF may be corrupted or not a valid PDF.',
    encrypted: 'This file is password protected and cannot be compressed. Unlock it first.',
    unreadable: 'Could not read this file. The PDF may be corrupted or not a valid PDF.',
  }
};

const PRESETS: { id: CompressionPreset; icon: typeof Printer }[] = [
  { id: 'printer', icon: Printer },
  { id: 'ebook', icon: BookOpen },
  { id: 'screen', icon: Smartphone }
];

export function CompressPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [source, setSource] = useState<SourceFile | null>(null);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [preset, setPreset] = useState<CompressionPreset>('ebook');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);

  const canCompress = source !== null && !busy;
  const savedPercent =
    result && result.originalSize > 0
      ? Math.round((1 - result.compressedSize / result.originalSize) * 100)
      : 0;
  const shrunk = result !== null && result.compressedSize < result.originalSize;

  const clearOutcome = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      clearOutcome();
      setSource(null);
      setNotice(undefined);
      setReading(true);
      void (async () => {
        try {
          const bytes = new Uint8Array(await readFileBytes(file));
          const pages = await getPdfPageCount(bytes);
          setSource({ file, bytes, pages });
        } catch (readError) {
          setNotice(readError instanceof EncryptedPdfError ? t.encrypted : t.unreadable);
        } finally {
          setReading(false);
        }
      })();
    },
    [clearOutcome, t]
  );

  const handleCompress = useCallback(async () => {
    if (!source || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await compressPdf(source.bytes, preset));
    } catch {
      setError(t.compressError);
    } finally {
      setBusy(false);
    }
  }, [busy, preset, source, t]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const base = source?.file.name.replace(/\.pdf$/i, '') ?? 'file';
    downloadBytes(result.bytes, withPdfSuffix(`${base}${vi ? '-nen' : '-compressed'}`));
  }, [result, source, vi]);

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>

      <div className="pdf-workspace pdf-workspace--two compress-workspace">
        <section className="ct-panel panel-section compress-panel" aria-label={t.title}>
          <FileDrop compact={source !== null} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {reading && <p className="compress-reading">{t.reading}</p>}

          {source && (
            <div className="compress-file">
              <span className="compress-file__name">{source.file.name}</span>
              <span className="compress-file__chips">
                <span className="ct-chip compress-chip">
                  <HardDrive size={13} aria-hidden="true" />
                  {formatBytes(source.file.size)}
                </span>
                <span className="ct-chip compress-chip">
                  <FileText size={13} aria-hidden="true" />
                  {t.pages(source.pages)}
                </span>
              </span>
            </div>
          )}
        </section>

        {source && (
          <section className="ct-panel panel-section compress-side">
            <div className="compress-presets" role="group" aria-label={t.presetLabel}>
              {PRESETS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`compress-preset${preset === id ? ' compress-preset--active' : ''}`}
                  aria-pressed={preset === id}
                  onClick={() => setPreset(id)}
                >
                  <Icon size={17} aria-hidden="true" className="compress-preset__icon" />
                  <span className="compress-preset__text">
                    <span className="compress-preset__title">{t.presetTitle[id]}</span>
                    <span className="compress-preset__hint">{t.presetHint[id]}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="action-bar">
              <button
                className="ct-button ct-button--primary compress-action"
                type="button"
                disabled={!canCompress}
                onClick={handleCompress}
              >
                {busy ? <span className="spinner" aria-hidden="true" /> : <Minimize2 size={17} aria-hidden="true" />}
                {busy ? t.compressing : t.compressAction}
              </button>
            </div>

            {source && !result && <p className="compress-first-note">{t.firstRunNote}</p>}

            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}

            {result && !shrunk && (
              <p className="notice compress-warning" role="alert">
                {t.cannotShrink}
              </p>
            )}

            {result && (
              <div className="notice notice--ok compress-result" role="status">
                <span className="compress-result__label">{t.resultReady}</span>
                <div className="compress-sizes">
                  <span className="compress-size">{formatBytes(result.originalSize)}</span>
                  <span className="compress-sizes__arrow" aria-hidden="true">→</span>
                  <span className="compress-size compress-size--out">{formatBytes(result.compressedSize)}</span>
                </div>
                {shrunk && <strong className="compress-saved">{t.saved(savedPercent)}</strong>}
                <button className="ct-button ct-button--accent compress-download" type="button" onClick={handleDownload}>
                  <Download size={16} aria-hidden="true" />
                  {t.download}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </ToolShell>
  );
}
