import { openPdfView } from './pdfPreview';

export type PageImageFormat = 'png' | 'jpg';

export interface PageImage {
  pageNumber: number;
  bytes: Uint8Array;
}

function canvasToBytes(canvas: HTMLCanvasElement, format: PageImageFormat, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('BLOB_FAILED'));
          return;
        }
        blob
          .arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(() => reject(new Error('BLOB_READ_FAILED')));
      },
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      quality
    );
  });
}

/** Renders every page of a PDF to PNG/JPG (page width in px, JPG quality 0–1). */
export async function renderPdfToImages(
  pdfBytes: Uint8Array,
  format: PageImageFormat,
  options: { width?: number; quality?: number } = {}
): Promise<PageImage[]> {
  const { width = 1600, quality = 0.9 } = options;
  const view = await openPdfView(pdfBytes);
  try {
    const images: PageImage[] = [];
    for (let pageNumber = 1; pageNumber <= view.pageCount; pageNumber += 1) {
      const canvas = document.createElement('canvas');
      await view.render(pageNumber, canvas, width, { forExport: true });
      images.push({ pageNumber, bytes: await canvasToBytes(canvas, format, quality) });
      canvas.width = 0;
      canvas.height = 0;
    }
    return images;
  } finally {
    view.destroy();
  }
}
