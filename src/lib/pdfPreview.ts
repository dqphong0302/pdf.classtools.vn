import * as pdfjs from 'pdfjs-dist';
// Vite resolves this to a hashed asset URL in builds; keeps the worker local (no CDN).
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPageView {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

export interface OpenedPdfView {
  pageCount: number;
  pages: PdfPageView[];
  render(pageNumber: number, canvas: HTMLCanvasElement, targetWidth: number): Promise<void>;
  getPageText(pageNumber: number): Promise<string>;
  destroy(): void;
}

/**
 * Opens a PDF with pdf.js for rendering previews. The input bytes are copied
 * because pdf.js transfers (detaches) the buffer it receives.
 */
export async function openPdfView(sourceBytes: Uint8Array): Promise<OpenedPdfView> {
  const data = new Uint8Array(sourceBytes.byteLength);
  data.set(sourceBytes);
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;

  const pages: PdfPageView[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      rotation: viewport.rotation
    });
  }

  return {
    pageCount: doc.numPages,
    pages,
    async render(pageNumber, canvas, targetWidth) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = targetWidth / base.width;
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    },
    async getPageText(pageNumber) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = '';
      content.items.forEach((item) => {
        if (!('str' in item)) return;
        text += item.str;
        if (item.hasEOL) text += '\n';
      });
      return text.replace(/[ \t]+\n/g, '\n').trim();
    },
    destroy() {
      void task.destroy();
    }
  };
}
