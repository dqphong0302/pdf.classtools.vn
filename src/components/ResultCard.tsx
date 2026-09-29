import { CheckCircle2, Download, RotateCcw } from 'lucide-react';

interface ResultCardProps {
  /** e.g. "Đã ghép thành 5 trang." */
  message: string;
  onDownload: () => void;
  /** Starts over with new files. */
  onReset: () => void;
  vi: boolean;
}

/** Final step of every tool: name the result, download it, or start over. */
export function ResultCard({ message, onDownload, onReset, vi }: ResultCardProps) {
  return (
    <div className="result-card" role="status">
      <span className="result-card__icon" aria-hidden="true">
        <CheckCircle2 size={34} />
      </span>
      <h2>{vi ? 'Xong rồi!' : 'All done!'}</h2>
      <p>{message}</p>

      <button type="button" className="result-card__download" onClick={onDownload}>
        <Download size={20} aria-hidden="true" />
        {vi ? 'Tải xuống' : 'Download'}
      </button>
      <button type="button" className="result-card__reset" onClick={onReset}>
        <RotateCcw size={15} aria-hidden="true" />
        {vi ? 'Làm với tệp khác' : 'Start over'}
      </button>
    </div>
  );
}
