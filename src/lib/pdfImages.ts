import { PDFDocument } from 'pdf-lib';
import { detectImageFormat } from './pdfEdit';
import { mmToPt } from './pdfPages';

export type ImagePageSize = 'auto' | 'a4' | 'letter';
export type ImageOrientation = 'portrait' | 'landscape' | 'auto';

export interface ImagesToPdfOptions {
  pageSize: ImagePageSize;
  orientation: ImageOrientation;
  /** Margin in mm applied in fixed-size modes (0 = full bleed). */
  marginMm: number;
}

const A4: [number, number] = [595, 842];
const LETTER: [number, number] = [612, 792];
/** 96dpi CSS px -> PDF pt. */
const PX_TO_PT = 0.75;
const MIN_IMAGE_BYTES = 8;

function fixedPageSize(pageSize: 'a4' | 'letter', orientation: 'portrait' | 'landscape'): [number, number] {
  const base = pageSize === 'a4' ? A4 : LETTER;
  return orientation === 'landscape' ? [base[1], base[0]] : base;
}

export interface ImageDrawPlan {
  index: number;
  pageWidth: number;
  pageHeight: number;
  drawWidth: number;
  drawHeight: number;
  x: number;
  y: number;
}

/** Pure placement math: fits an image into a page with margins, keeping aspect ratio. */
export function planImagePlacement(
  imageSize: { width: number; height: number },
  pageSize: [number, number],
  marginPt: number
): ImageDrawPlan {
  const maxW = Math.max(1, pageSize[0] - marginPt * 2);
  const maxH = Math.max(1, pageSize[1] - marginPt * 2);
  const scale = Math.min(maxW / imageSize.width, maxH / imageSize.height);
  const drawWidth = imageSize.width * scale;
  const drawHeight = imageSize.height * scale;
  return {
    index: 0,
    pageWidth: pageSize[0],
    pageHeight: pageSize[1],
    drawWidth,
    drawHeight,
    x: (pageSize[0] - drawWidth) / 2,
    y: (pageSize[1] - drawHeight) / 2
  };
}

export function parseOrientation(imageWidth: number, imageHeight: number): 'portrait' | 'landscape' {
  return imageWidth > imageHeight ? 'landscape' : 'portrait';
}

/** Converts a batch of PNG/JPG images into a single PDF (one image per page). */
export async function imagesToPdf(files: Uint8Array[], options: ImagesToPdfOptions): Promise<Uint8Array> {
  const usable = files.filter((bytes) => bytes.byteLength >= MIN_IMAGE_BYTES);
  if (!usable.length) throw new Error('NO_IMAGES');

  const output = await PDFDocument.create();

  for (const bytes of usable) {
    const format = detectImageFormat(bytes);
    const embedded = format === 'jpg' ? await output.embedJpg(bytes) : await output.embedPng(bytes);

    let page: [number, number];
    if (options.pageSize === 'auto') {
      const naturalWidth = embedded.width * PX_TO_PT;
      const naturalHeight = embedded.height * PX_TO_PT;
      const long = Math.max(naturalWidth, naturalHeight);
      const short = Math.min(naturalWidth, naturalHeight);
      // "auto" keeps the image's own shape; a forced orientation turns the page to match.
      page =
        options.orientation === 'landscape'
          ? [long, short]
          : options.orientation === 'portrait'
            ? [short, long]
            : [naturalWidth, naturalHeight];
    } else {
      const orientation = options.orientation === 'auto'
        ? (embedded.width >= embedded.height ? 'landscape' : 'portrait')
        : options.orientation;
      page = fixedPageSize(options.pageSize, orientation);
    }

    const marginPt = mmToPt(options.marginMm);
    const plan = planImagePlacement({ width: embedded.width, height: embedded.height }, page, marginPt);
    const sheet = output.addPage([page[0], page[1]]);
    sheet.drawImage(embedded, { x: plan.x, y: plan.y, width: plan.drawWidth, height: plan.drawHeight });
  }

  output.setProducer('ClassTools PDF');
  return output.save();
}
