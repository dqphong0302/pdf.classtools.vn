import { PDFDocument } from 'pdf-lib';

export interface RedactBox {
  pageIndex: number; // 0-based
  /** Visual page coordinates in pt (as pdf.js shows the page, bottom-left origin). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RedactColor = 'black' | 'white';

export interface RasterizedPage {
  /** JPEG or PNG bytes of the page with the boxes already painted in. */
  bytes: Uint8Array;
  format: 'jpg' | 'png';
  /** Visual page size in pt. */
  width: number;
  height: number;
}

/** Renders one page (0-based) with its redaction boxes burnt into the pixels. */
export type PageRasterizer = (pageIndex: number, boxes: RedactBox[], color: RedactColor) => Promise<RasterizedPage>;

const RASTER_SCALE = 2; // ≈144 dpi — keeps text legible without huge files

/** Browser rasterizer: pdf.js → canvas → fill boxes → JPEG. */
export function createCanvasRasterizer(sourceBytes: Uint8Array): { rasterize: PageRasterizer; destroy(): void } {
  let viewPromise: Promise<import('./pdfPreview').OpenedPdfView> | null = null;
  const getView = () => {
    viewPromise ??= import('./pdfPreview').then(({ openPdfView }) => openPdfView(sourceBytes));
    return viewPromise;
  };
  return {
    async rasterize(pageIndex, boxes, color) {
      const view = await getView();
      const info = view.pages[pageIndex];
      const canvas = document.createElement('canvas');
      await view.render(pageIndex + 1, canvas, info.width * RASTER_SCALE);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
      const scale = canvas.width / info.width;
      ctx.fillStyle = color === 'black' ? '#000' : '#fff';
      for (const box of boxes) {
        ctx.fillRect(
          Math.floor(box.x * scale),
          Math.floor((info.height - box.y - box.height) * scale),
          Math.ceil(box.width * scale) + 1,
          Math.ceil(box.height * scale) + 1
        );
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('CANVAS_EXPORT_FAILED');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      canvas.width = 0;
      canvas.height = 0;
      return { bytes, format: 'jpg', width: info.width, height: info.height };
    },
    destroy() {
      void viewPromise?.then((view) => view.destroy());
    }
  };
}

/**
 * True redaction: every page that has a box is replaced by a flat image of itself
 * with the boxes painted in, so the text, vectors and images underneath are gone.
 * The output is built in a fresh document (copyPages only pulls referenced objects),
 * otherwise the original page content would still sit in the file unreferenced.
 */
export async function redactPdf(
  sourceBytes: Uint8Array,
  boxes: RedactBox[],
  color: RedactColor = 'black',
  rasterizer?: PageRasterizer
): Promise<Uint8Array> {
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  // Widgets would otherwise keep field values alive on copied pages.
  try {
    source.getForm().flatten();
  } catch {
    // No interactive form
  }

  const pageCount = source.getPageCount();
  const byPage = new Map<number, RedactBox[]>();
  for (const box of boxes) {
    if (box.pageIndex < 0 || box.pageIndex >= pageCount || box.width <= 0 || box.height <= 0) continue;
    byPage.set(box.pageIndex, [...(byPage.get(box.pageIndex) ?? []), box]);
  }

  let ownRasterizer: ReturnType<typeof createCanvasRasterizer> | null = null;
  const rasterize = rasterizer ?? (ownRasterizer = createCanvasRasterizer(sourceBytes)).rasterize;

  try {
    const output = await PDFDocument.create();
    const keptIndices = Array.from({ length: pageCount }, (_, i) => i).filter((i) => !byPage.has(i));
    const copied = await output.copyPages(source, keptIndices);
    const copiedByIndex = new Map(keptIndices.map((index, i) => [index, copied[i]]));

    for (let index = 0; index < pageCount; index += 1) {
      const kept = copiedByIndex.get(index);
      if (kept) {
        output.addPage(kept);
        continue;
      }
      const raster = await rasterize(index, byPage.get(index)!, color);
      const image = raster.format === 'png' ? await output.embedPng(raster.bytes) : await output.embedJpg(raster.bytes);
      const page = output.addPage([raster.width, raster.height]);
      page.drawImage(image, { x: 0, y: 0, width: raster.width, height: raster.height });
    }

    output.setProducer('ClassTools PDF');
    output.setCreator('ClassTools PDF');
    return await output.save();
  } finally {
    ownRasterizer?.destroy();
  }
}
