import { useCallback, useState } from 'react';
import { ArrowLeft, FileText, LayoutGrid } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ResultCard } from '../components/ResultCard';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { createNup } from '../lib/pdfNup';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import './nup.css';

const MAX_FILE_BYTES = 100 * 1024 * 1024;

interface NupPreset {
  id: string;
  label: string;
  cols: number;
  rows: number;
}

const PRESETS: NupPreset[] = [
  { id: '1x2', label: '1×2', cols: 1, rows: 2 },
  { id: '2x2', label: '2×2', cols: 2, rows: 2 },
  { id: '2x3', label: '2×3', cols: 2, rows: 3 },
  { id: '3x3', label: '3×3', cols: 3, rows: 3 }
];

interface SourceDoc {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

interface NupStrings {
  back: string;
  title: string;
  description: string;
  dropLabel: string;
  dropHint: string;
  pages: (count: number) => string;
  layoutLabel: string;
  landscape: string;
  estimate: (sheets: number) => string;
  outputLabel: string;
  outputAria: string;
  action: string;
  applying: string;
  resultText: (pages: number, sheets: number) => string;
  download: string;
  opError: string;
  encrypted: string;
  unreadable: string;
  oversized: string;
}

const STRINGS: Record<'vi' | 'en', NupStrings> = {
  vi: {
    back: 'Trang chủ',
    title: 'N-trang trên 1 tờ',
    description:
      'Sắp nhiều trang PDF lên mỗi tờ A4 (1×2, 2×2, 2×3, 3×3), trang được căn giữa từng ô. Mọi thao tác chạy ngay trên thiết bị của bạn.',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    pages: (count) => `${count} trang`,
    layoutLabel: 'Bố cục mỗi tờ A4',
    landscape: 'Tờ ngang (A4 landscape)',
    estimate: (sheets) => `Sẽ tạo ${sheets} tờ A4`,
    outputLabel: 'Tên tệp kết quả',
    outputAria: 'Tên tệp kết quả',
    action: 'Tạo PDF N-trang',
    applying: 'Đang tạo…',
    resultText: (pages, sheets) => `${pages} trang gốc → ${sheets} tờ A4`,
    download: 'Tải xuống',
    opError: 'Không thể tạo PDF N-trang. Tệp có thể bị hỏng hoặc không phải PDF hợp lệ.',
    encrypted: 'Tệp được bảo vệ bằng mật khẩu nên không thể xử lý.',
    unreadable: 'Không đọc được tệp. Tệp có thể bị hỏng hoặc không phải PDF.',
    oversized: 'Bỏ qua tệp quá 100 MB.'
  },
  en: {
    back: 'Home',
    title: 'N-up pages per sheet',
    description:
      'Lay multiple PDF pages onto each A4 sheet (1×2, 2×2, 2×3, 3×3), centered per cell. Everything runs on your device.',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    pages: (count) => `${count} pages`,
    layoutLabel: 'Layout per A4 sheet',
    landscape: 'Landscape (A4 landscape)',
    estimate: (sheets) => `Will produce ${sheets} A4 sheets`,
    outputLabel: 'Output file name',
    outputAria: 'Output file name',
    action: 'Create N-up PDF',
    applying: 'Creating…',
    resultText: (pages, sheets) => `${pages} source pages → ${sheets} A4 sheets`,
    download: 'Download',
    opError: 'Could not create the N-up PDF. The file may be corrupted or not a valid PDF.',
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

export function NupPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [source, setSource] = useState<SourceDoc | null>(null);
  const [presetId, setPresetId] = useState('2x2');
  const [landscape, setLandscape] = useState(true);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; pages: number; sheets: number } | null>(null);

  const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[1];
  const sheetCount = source ? Math.ceil(source.pageCount / (preset.cols * preset.rows)) : 0;
  const outputName = (source ? `${source.file.name.replace(/\.pdf$/i, '')}-nup` : 'nup');

  const clearOutcome = useCallback(() => {
    setOpError(null);
    setResult(null);
  }, []);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      clearOutcome();
      setNotice(undefined);
      if (file.size > MAX_FILE_BYTES) {
        setSource(null);
        setNotice(t.oversized);
        return;
      }
      void (async () => {
        try {
          const bytes = new Uint8Array(await readFileBytes(file));
          const pageCount = await getPdfPageCount(bytes);
          setSource({ file, bytes, pageCount });
        } catch (error) {
          setSource(null);
          setNotice(error instanceof EncryptedPdfError ? t.encrypted : t.unreadable);
        }
      })();
    },
    [clearOutcome, t]
  );

  const handleApply = useCallback(async () => {
    if (!source || busy) return;
    clearOutcome();
    setBusy(true);
    try {
      const bytes = await createNup(source.bytes, { cols: preset.cols, rows: preset.rows, landscape });
      const sheets = await getPdfPageCount(bytes);
      setResult({ bytes, pages: source.pageCount, sheets });
    } catch {
      setOpError(t.opError);
    } finally {
      setBusy(false);
    }
  }, [source, busy, preset, landscape, clearOutcome, t]);

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
          <LayoutGrid size={14} aria-hidden="true" /> ClassTools PDF
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </div>

      <div className="flow nup-workspace">
        {result ? (
          <ResultCard
            vi={vi}
            message={t.resultText(result.pages, result.sheets)}
            onDownload={handleDownload}
            onReset={() => {
              setSource(null);
              setNotice(undefined);
              clearOutcome();
            }}
          />
        ) : (
          <section className="ct-panel panel-section nup-panel" aria-label={t.dropLabel}>
            <FileDrop compact={source !== null} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

            {source && (
              <>
                <div className="nup-source-info">
                  <span className="nup-source-name">{fileSummary(source.file)}</span>
                  <span className="ct-chip nup-chip">
                    <FileText size={13} aria-hidden="true" />
                    {t.pages(source.pageCount)}
                  </span>
                </div>

                <div className="field">
                  <span>{t.layoutLabel}</span>
                  <div className="nup-presets" role="group" aria-label={t.layoutLabel}>
                    {PRESETS.map((item) => {
                      const active = item.id === preset.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`nup-preset${active ? ' is-active' : ''}`}
                          aria-pressed={active}
                          onClick={() => {
                            setPresetId(item.id);
                            clearOutcome();
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="nup-landscape">
                  <input
                    type="checkbox"
                    checked={landscape}
                    onChange={(event) => {
                      setLandscape(event.target.checked);
                      clearOutcome();
                    }}
                  />
                  {t.landscape}
                </label>

                {sheetCount > 0 && !busy && (
                  <p className="flow-hint" role="status">
                    {t.estimate(sheetCount)}
                  </p>
                )}

                {opError && (
                  <p className="notice" role="alert">
                    {opError}
                  </p>
                )}

                <div className="action-bar flow-actions">
                  <button className="primary-action" type="button" disabled={busy} onClick={() => void handleApply()}>
                    {busy ? <span className="spinner" aria-hidden="true" /> : <LayoutGrid size={19} aria-hidden="true" />}
                    {busy ? t.applying : t.action}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </ToolShell>
  );
}
