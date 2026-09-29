import { useCallback, useState } from 'react';
import { ArrowLeft, Download, FileText, Info, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { FileDrop } from '../components/FileDrop';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { downloadBytes, fileSummary, withPdfSuffix } from '../lib/download';
import { EncryptedPdfError, getPdfPageCount } from '../lib/pdfOps';
import { decryptPdf, encryptPdf, type EncryptionStrength } from '../lib/wasmQpdf';
import './protect.css';

const MIN_PASSWORD_LENGTH = 4;

type Mode = 'encrypt' | 'decrypt';

interface ProtectSource {
  file: File;
  bytes: Uint8Array;
  /** -1 when the page count cannot be read (e.g. the file is encrypted). */
  pages: number;
}

interface ProtectStrings {
  back: string;
  title: string;
  description: string;
  dropLabel: string;
  dropHint: string;
  pages: (count: number) => string;
  modeLabel: string;
  tabEncrypt: string;
  tabDecrypt: string;
  userLabel: string;
  ownerLabel: string;
  strengthLabel: string;
  minChars: string;
  firstRunNote: string;
  encryptAction: string;
  encrypting: string;
  decryptLabel: string;
  decryptHint: string;
  decryptAction: string;
  decrypting: string;
  encryptSuccess: string;
  decryptSuccess: string;
  download: string;
  encryptFailed: string;
  decryptFailed: string;
  encryptedHint: string;
  encryptedChip: string;
  unreadable: (name: string) => string;
  privacy: string;
}

const STRINGS: Record<'vi' | 'en', ProtectStrings> = {
  vi: {
    back: 'Trang chủ',
    title: 'Bảo vệ PDF',
    description: 'Đặt mật khẩu hoặc mở khóa tệp PDF bằng qpdf chạy ngay trên thiết bị của bạn. Không có tệp nào được gửi đi.',
    dropLabel: 'Chọn hoặc kéo thả tệp PDF',
    dropHint: 'Một tệp PDF duy nhất',
    pages: (count) => `${count} trang`,
    modeLabel: 'Chế độ bảo vệ',
    tabEncrypt: 'Đặt mật khẩu',
    tabDecrypt: 'Mở khóa',
    userLabel: 'Mật khẩu để mở tệp',
    ownerLabel: 'Mật khẩu chủ (quyền hạn)',
    strengthLabel: 'Độ mạnh mã hóa',
    minChars: 'Tối thiểu 4 ký tự',
    firstRunNote: 'Lần đầu sử dụng sẽ tải mô-đun (~1 MB).',
    encryptAction: 'Mã hóa & tải xuống',
    encrypting: 'Đang mã hóa…',
    decryptLabel: 'Mật khẩu (tùy chọn)',
    decryptHint: 'Chỉ cần nếu tệp yêu cầu mật khẩu',
    decryptAction: 'Mở khóa & tải xuống',
    decrypting: 'Đang mở khóa…',
    encryptSuccess: 'Đã đặt mật khẩu cho tệp PDF.',
    decryptSuccess: 'Đã mở khóa tệp PDF.',
    download: 'Tải xuống',
    encryptFailed: 'Không thể mã hóa tệp này. Vui lòng thử lại.',
    decryptFailed: 'Sai mật khẩu hoặc tệp không thể mở khóa.',
    encryptedHint: 'Tệp đang được bảo vệ — chuyển sang tab Mở khóa.',
    encryptedChip: 'Được bảo vệ',
    unreadable: (name) => `Không đọc được tệp: ${name}.`,
    privacy: 'Mật khẩu chỉ dùng ngay trên thiết bị, không được gửi đi đâu.'
  },
  en: {
    back: 'Home',
    title: 'Protect PDF',
    description: 'Set a password or unlock PDF files with qpdf running right on your device. No file is ever uploaded.',
    dropLabel: 'Drop or choose a PDF file',
    dropHint: 'A single PDF file',
    pages: (count) => `${count} pages`,
    modeLabel: 'Protection mode',
    tabEncrypt: 'Set password',
    tabDecrypt: 'Unlock',
    userLabel: 'Password to open the file',
    ownerLabel: 'Owner password (permissions)',
    strengthLabel: 'Encryption strength',
    minChars: 'At least 4 characters',
    firstRunNote: 'First use downloads the module (~1 MB).',
    encryptAction: 'Encrypt & download',
    encrypting: 'Encrypting…',
    decryptLabel: 'Password (optional)',
    decryptHint: 'Only needed if the file requires a password',
    decryptAction: 'Unlock & download',
    decrypting: 'Unlocking…',
    encryptSuccess: 'Password applied to the PDF.',
    decryptSuccess: 'PDF unlocked.',
    download: 'Download',
    encryptFailed: 'Could not encrypt this file. Please try again.',
    decryptFailed: 'Wrong password or the file cannot be unlocked.',
    encryptedHint: 'This file is protected — switched to the Unlock tab.',
    encryptedChip: 'Protected',
    unreadable: (name) => `Could not read the file: ${name}.`,
    privacy: 'Passwords are used only on this device and never sent anywhere.'
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

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

export function ProtectPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';
  const t = STRINGS[locale];

  const [mode, setMode] = useState<Mode>('encrypt');
  const [source, setSource] = useState<ProtectSource | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [strength, setStrength] = useState<EncryptionStrength>('256');
  const [decryptPassword, setDecryptPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; name: string; message: string } | null>(null);

  const passwordsValid = userPassword.length >= MIN_PASSWORD_LENGTH && ownerPassword.length >= MIN_PASSWORD_LENGTH;

  const clearOutcome = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      const file = incoming[0];
      if (!file) return;
      clearOutcome();
      setNotice(undefined);
      void (async () => {
        try {
          const bytes = new Uint8Array(await readFileBytes(file));
          try {
            const pages = await getPdfPageCount(bytes);
            setSource({ file, bytes, pages });
          } catch (pageError) {
            if (pageError instanceof EncryptedPdfError) {
              setSource({ file, bytes, pages: -1 });
              setMode('decrypt');
              setNotice(t.encryptedHint);
            } else {
              setSource(null);
              setNotice(t.unreadable(file.name));
            }
          }
        } catch {
          setSource(null);
          setNotice(t.unreadable(file.name));
        }
      })();
    },
    [clearOutcome, t]
  );

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next);
      clearOutcome();
    },
    [clearOutcome]
  );

  const handleEncrypt = useCallback(async () => {
    if (!source || !passwordsValid || busy) return;
    setBusy(true);
    clearOutcome();
    try {
      const bytes = await encryptPdf(source.bytes, { user: userPassword, owner: ownerPassword }, strength);
      const name = withPdfSuffix(`${baseName(source.file.name)}-${vi ? 'mat-khau' : 'protected'}`);
      downloadBytes(bytes, name);
      setResult({ bytes, name, message: t.encryptSuccess });
    } catch {
      setError(t.encryptFailed);
    } finally {
      setBusy(false);
    }
  }, [source, passwordsValid, busy, userPassword, ownerPassword, strength, vi, t, clearOutcome]);

  const handleDecrypt = useCallback(async () => {
    if (!source || busy) return;
    setBusy(true);
    clearOutcome();
    try {
      const bytes = await decryptPdf(source.bytes, decryptPassword);
      const name = withPdfSuffix(`${baseName(source.file.name)}-${vi ? 'mo-khoa' : 'unlocked'}`);
      downloadBytes(bytes, name);
      setResult({ bytes, name, message: t.decryptSuccess });
    } catch {
      setError(t.decryptFailed);
    } finally {
      setBusy(false);
    }
  }, [source, busy, decryptPassword, vi, t, clearOutcome]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBytes(result.bytes, result.name);
  }, [result]);

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="tool-page-heading tool-page-heading--compact">
        <a className="tool-page-heading__back" href="/">
          <ArrowLeft size={17} aria-hidden="true" /> {t.back}
        </a>
        <span className="ct-eyebrow">
          <Lock size={14} aria-hidden="true" /> ClassTools PDF
        </span>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </div>

      <div className="pdf-workspace pdf-workspace--two protect-workspace">
        <section className="ct-panel panel-section protect-panel" aria-label={t.dropLabel}>
          <FileDrop compact={source !== null} label={t.dropLabel} hint={t.dropHint} onFiles={handleFiles} notice={notice} />

          {source && (
            <div className="protect-source-info">
              <span className="protect-source-name">{fileSummary(source.file)}</span>
              {source.pages >= 0 ? (
                <span className="ct-chip protect-chip">
                  <FileText size={13} aria-hidden="true" />
                  {t.pages(source.pages)}
                </span>
              ) : (
                <span className="ct-chip protect-chip protect-chip--encrypted">
                  <Lock size={13} aria-hidden="true" />
                  {t.encryptedChip}
                </span>
              )}
            </div>
          )}
        </section>

        {source && (
          <section className="ct-panel panel-section protect-panel" aria-label={t.title}>
            <div className="protect-tabs" role="group" aria-label={t.modeLabel}>
              <button type="button" className="protect-tab" aria-pressed={mode === 'encrypt'} onClick={() => switchMode('encrypt')}>
                <Lock size={15} aria-hidden="true" />
                {t.tabEncrypt}
              </button>
              <button type="button" className="protect-tab" aria-pressed={mode === 'decrypt'} onClick={() => switchMode('decrypt')}>
                <LockOpen size={15} aria-hidden="true" />
                {t.tabDecrypt}
              </button>
            </div>

            {mode === 'encrypt' ? (
              <div className="protect-fields">
                <label className="field protect-field">
                  <span>{t.userLabel}</span>
                  <input
                    type="password"
                    value={userPassword}
                    aria-label={t.userLabel}
                    autoComplete="new-password"
                    onChange={(event) => setUserPassword(event.target.value)}
                  />
                  {userPassword.length > 0 && userPassword.length < MIN_PASSWORD_LENGTH && (
                    <span className="protect-field-hint protect-field-hint--warn">{t.minChars}</span>
                  )}
                </label>
                <label className="field protect-field">
                  <span>{t.ownerLabel}</span>
                  <input
                    type="password"
                    value={ownerPassword}
                    aria-label={t.ownerLabel}
                    autoComplete="new-password"
                    onChange={(event) => setOwnerPassword(event.target.value)}
                  />
                  {ownerPassword.length > 0 && ownerPassword.length < MIN_PASSWORD_LENGTH && (
                    <span className="protect-field-hint protect-field-hint--warn">{t.minChars}</span>
                  )}
                </label>

                <div className="protect-strength-row">
                  <span className="protect-strength-label">{t.strengthLabel}</span>
                  <div className="protect-strength" role="group" aria-label={t.strengthLabel}>
                    {(['128', '256'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={strength === value}
                        onClick={() => setStrength(value)}
                      >
                        {value === '128' ? 'AES-128' : 'AES-256'}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="protect-note">
                  <Info size={14} aria-hidden="true" />
                  {t.firstRunNote}
                </p>

                <div className="action-bar">
                  <button
                    className="ct-button ct-button--primary protect-action"
                    type="button"
                    disabled={!source || !passwordsValid || busy}
                    onClick={handleEncrypt}
                  >
                    {busy ? <span className="spinner" aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />}
                    {busy ? t.encrypting : t.encryptAction}
                  </button>
                </div>
              </div>
            ) : (
              <div className="protect-fields">
                <label className="field protect-field">
                  <span>{t.decryptLabel}</span>
                  <input
                    type="password"
                    value={decryptPassword}
                    aria-label={t.decryptLabel}
                    autoComplete="off"
                    onChange={(event) => setDecryptPassword(event.target.value)}
                  />
                </label>
                <p className="protect-field-hint">{t.decryptHint}</p>

                <div className="action-bar">
                  <button
                    className="ct-button ct-button--primary protect-action"
                    type="button"
                    disabled={!source || busy}
                    onClick={handleDecrypt}
                  >
                    {busy ? <span className="spinner" aria-hidden="true" /> : <LockOpen size={17} aria-hidden="true" />}
                    {busy ? t.decrypting : t.decryptAction}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}

            {result && (
              <div className="notice notice--ok protect-result" role="status">
                <span>{result.message}</span>
                <button className="ct-button ct-button--accent" type="button" onClick={handleDownload}>
                  <Download size={16} aria-hidden="true" />
                  {t.download}
                </button>
              </div>
            )}

            <p className="protect-privacy">
              <ShieldCheck size={16} aria-hidden="true" />
              {t.privacy}
            </p>
          </section>
        )}
      </div>
    </ToolShell>
  );
}
