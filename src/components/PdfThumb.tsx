import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { openPdfView } from '../lib/pdfPreview';

/** First-page thumbnail of a PDF; falls back to an icon if it cannot be rendered. */
export function PdfThumb({ bytes, width = 160 }: { bytes: Uint8Array; width?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bytes.byteLength) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;
    openPdfView(bytes)
      .then(async (view) => {
        destroy = () => view.destroy();
        if (cancelled) return;
        await view.render(1, canvas, width);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [bytes, width]);

  return failed || !bytes.byteLength ? (
    <span className="file-card__fallback" aria-hidden="true">
      <FileText size={36} />
    </span>
  ) : (
    <canvas ref={canvasRef} aria-hidden="true" />
  );
}
