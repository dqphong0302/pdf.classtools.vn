import { useCallback, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
interface FileDropProps {
  multiple?: boolean;
  label: string;
  hint?: string;
  onFiles: (files: File[]) => void;
  notice?: string;
}

export function FileDrop({ multiple = false, label, hint, onFiles, notice }: FileDropProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const pdfs = Array.from(list).filter((file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    if (!pdfs.length) return;
    onFiles(multiple ? pdfs : [pdfs[0]]);
  }, [multiple, onFiles]);

  return (
    <div className="file-drop-stack">
      <div
        className={`file-drop${dragging ? ' file-drop--dragging' : ''}`}
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
        <FileUp size={30} aria-hidden="true" />
        <strong>{label}</strong>
        {hint && <span>{hint}</span>}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={multiple}
          className="ct-visually-hidden"
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {notice && <p className="file-drop__notice" role="alert">{notice}</p>}
      <p className="file-drop__meta">{multiple ? 'PDF' : 'PDF'} · max 100 MB</p>
    </div>
  );
}
