import { useCallback, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
interface FileDropProps {
  multiple?: boolean;
  label: string;
  hint?: string;
  onFiles: (files: File[]) => void;
  notice?: string;
  accept?: string;
  acceptPattern?: RegExp;
  /** Shown under the drop zone, e.g. "PDF" or "XLSX · XLS · CSV". */
  formatLabel?: string;
  /** Slim single-row variant, used once a file is already loaded. */
  compact?: boolean;
  maxBytes?: number;
}

export const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

export function FileDrop({
  multiple = false,
  label,
  hint,
  onFiles,
  notice,
  accept = 'application/pdf,.pdf',
  acceptPattern = /\.pdf$/i,
  formatLabel = 'PDF',
  compact = false,
  maxBytes = DEFAULT_MAX_BYTES
}: FileDropProps) {
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const all = Array.from(list);
    const mimeTypes = accept.split(',').map((item) => item.trim()).filter((item) => item.includes('/'));
    const typed = all.filter((file) => acceptPattern.test(file.name) || mimeTypes.includes(file.type));
    const sized = typed.filter((file) => file.size <= maxBytes);
    const maxMb = Math.round(maxBytes / 1024 / 1024);
    // The page shell keeps <html lang> in sync with the chosen locale.
    const vi = document.documentElement.lang !== 'en';
    const oversized = typed.filter((file) => file.size > maxBytes).map((file) => file.name).join(', ');
    if (oversized) {
      setRejection(vi ? `Bỏ qua tệp quá ${maxMb} MB: ${oversized}.` : `Skipped file over ${maxMb} MB: ${oversized}.`);
    } else if (typed.length < all.length) {
      setRejection(vi ? `Chỉ nhận tệp ${formatLabel}.` : `Only ${formatLabel} files are accepted.`);
    } else {
      setRejection(null);
    }
    if (!sized.length) return;
    onFiles(multiple ? sized : [sized[0]]);
  }, [multiple, onFiles, acceptPattern, accept, maxBytes, formatLabel]);

  return (
    <div className="file-drop-stack">
      <div
        className={`file-drop${compact ? ' file-drop--compact' : ''}${dragging ? ' file-drop--dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          acceptFiles(event.dataTransfer.files);
        }}
      >
        <span className="file-drop__icon" aria-hidden="true">
          <FileUp size={30} />
        </span>
        <strong>{label}</strong>
        <span className="file-drop__button" aria-hidden="true">
          {compact
            ? document.documentElement.lang === 'en' ? (multiple ? 'Add files' : 'Change file') : multiple ? 'Thêm tệp' : 'Đổi tệp'
            : document.documentElement.lang === 'en' ? (multiple ? 'Choose files' : 'Choose file') : 'Chọn tệp'}
        </span>
        {!compact && (
          <span>{document.documentElement.lang === 'en' ? 'or drag & drop here' : 'hoặc kéo và thả vào đây'}{hint ? ` · ${hint}` : ''}</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="ct-visually-hidden"
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {(rejection || notice) && (
        <p className="file-drop__notice" role="alert">{[rejection, notice].filter(Boolean).join(' ')}</p>
      )}
      {!compact && <p className="file-drop__meta">{formatLabel} · max {Math.round(maxBytes / 1024 / 1024)} MB</p>}
    </div>
  );
}
