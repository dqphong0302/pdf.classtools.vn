import { PDFDocument, degrees, type PDFFont } from 'pdf-lib';
import { ensureEmbeddedFonts, hexToPdfRgb } from './pdfEdit';
import { centeredOrigin, pageFrame } from './pdfPlacement';

export interface TextWatermarkOptions {
  type: 'text';
  text: string;
  angle: number; // e.g. 45 or -45
  opacity: number; // 0.1 to 1.0
  fontSize: number; // e.g. 48
  colorHex: string; // e.g. '#ff0000' or '#888888'
  tiled: boolean; // if true, repeat across page in grid
}

export interface ImageWatermarkOptions {
  type: 'image';
  imageBytes: Uint8Array;
  isPng: boolean;
  angle: number;
  opacity: number;
  scale: number; // 0.2 to 1.5
  tiled: boolean;
}

export type WatermarkOptions = TextWatermarkOptions | ImageWatermarkOptions;

/**
 * Centres (visual space) of every stamp on a page. When tiled, the grid step is the
 * stamp's rotated bounding box plus `gap`, with every other row shifted by half a
 * step, so rotated stamps never overlap.
 */
export function watermarkCentres(
  pageWidth: number,
  pageHeight: number,
  tiled: boolean,
  stamp: { width: number; height: number; angle: number; gap: number }
) {
  if (!tiled) return [{ x: pageWidth / 2, y: pageHeight / 2 }];
  const rad = (stamp.angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const stepX = stamp.width * cos + stamp.height * sin + stamp.gap;
  const stepY = stamp.width * sin + stamp.height * cos + stamp.gap;
  const centres: { x: number; y: number }[] = [];
  for (let row = 0, y = stepY / 2; y < pageHeight + stepY / 2; row += 1, y += stepY) {
    const shift = row % 2 ? stepX / 2 : 0;
    for (let x = stepX / 2 - shift; x < pageWidth + stepX / 2; x += stepX) {
      centres.push({ x, y });
    }
  }
  return centres;
}

/** Stamps a text watermark (centred or tiled) on every page of an open document. */
export function stampTextWatermark(
  pdf: PDFDocument,
  font: PDFFont,
  options: Pick<TextWatermarkOptions, 'text' | 'angle' | 'opacity' | 'fontSize' | 'colorHex' | 'tiled'>
): void {
  const color = hexToPdfRgb(options.colorHex);
  const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
  // Cap height ≈ 0.7em; centring on it keeps the glyphs visually centred.
  const textHeight = options.fontSize * 0.7;

  for (const page of pdf.getPages()) {
    const frame = pageFrame(page);
    const centres = watermarkCentres(frame.width, frame.height, options.tiled, {
      width: textWidth,
      height: textHeight,
      angle: options.angle,
      gap: options.fontSize
    });
    for (const centre of centres) {
      const origin = centeredOrigin(centre.x, centre.y, textWidth, textHeight, options.angle);
      const at = frame.toPdf(origin.x, origin.y);
      page.drawText(options.text, {
        x: at.x,
        y: at.y,
        size: options.fontSize,
        font,
        color,
        opacity: options.opacity,
        rotate: degrees(options.angle + frame.rotation)
      });
    }
  }
}

export async function addWatermark(
  sourceBytes: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });

  if (options.type === 'text') {
    const fonts = await ensureEmbeddedFonts(pdf);
    stampTextWatermark(pdf, fonts.bold, options);
  } else {
    const embeddedImage = options.isPng
      ? await pdf.embedPng(options.imageBytes)
      : await pdf.embedJpg(options.imageBytes);

    const imageWidth = embeddedImage.width * options.scale;
    const imageHeight = embeddedImage.height * options.scale;

    for (const page of pdf.getPages()) {
      const frame = pageFrame(page);
      const centres = watermarkCentres(frame.width, frame.height, options.tiled, {
        width: imageWidth,
        height: imageHeight,
        angle: options.angle,
        gap: 40
      });
      for (const centre of centres) {
        const origin = centeredOrigin(centre.x, centre.y, imageWidth, imageHeight, options.angle);
        const at = frame.toPdf(origin.x, origin.y);
        page.drawImage(embeddedImage, {
          x: at.x,
          y: at.y,
          width: imageWidth,
          height: imageHeight,
          opacity: options.opacity,
          rotate: degrees(options.angle + frame.rotation)
        });
      }
    }
  }

  return await pdf.save();
}
