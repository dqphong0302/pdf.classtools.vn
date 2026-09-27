import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { ensureEmbeddedFonts } from './pdfEdit';

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

export async function addWatermark(
  sourceBytes: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const count = pdf.getPageCount();

  if (options.type === 'text') {
    const fonts = await ensureEmbeddedFonts(pdf);
    const cleanHex = options.colorHex.replace('#', '').trim();
    const r = parseInt(cleanHex.slice(0, 2), 16) / 255 || 0.5;
    const g = parseInt(cleanHex.slice(2, 4), 16) / 255 || 0.5;
    const b = parseInt(cleanHex.slice(4, 6), 16) / 255 || 0.5;
    const color = rgb(r, g, b);

    for (let i = 0; i < count; i++) {
      const page = pdf.getPage(i);
      const { width, height } = page.getSize();
      const textWidth = fonts.bold.widthOfTextAtSize(options.text, options.fontSize);

      if (options.tiled) {
        // Draw grid
        const stepX = Math.max(180, textWidth + 60);
        const stepY = 160;
        for (let x = -width / 2; x < width * 1.5; x += stepX) {
          for (let y = -height / 2; y < height * 1.5; y += stepY) {
            page.drawText(options.text, {
              x,
              y,
              size: options.fontSize,
              font: fonts.bold,
              color,
              opacity: options.opacity,
              rotate: degrees(options.angle)
            });
          }
        }
      } else {
        // Single centered watermark
        const cx = (width - textWidth) / 2;
        const cy = height / 2;
        page.drawText(options.text, {
          x: cx,
          y: cy,
          size: options.fontSize,
          font: fonts.bold,
          color,
          opacity: options.opacity,
          rotate: degrees(options.angle)
        });
      }
    }
  } else {
    // Image watermark
    const embeddedImage = options.isPng
      ? await pdf.embedPng(options.imageBytes)
      : await pdf.embedJpg(options.imageBytes);

    const baseWidth = embeddedImage.width * options.scale;
    const baseHeight = embeddedImage.height * options.scale;

    for (let i = 0; i < count; i++) {
      const page = pdf.getPage(i);
      const { width, height } = page.getSize();

      if (options.tiled) {
        const stepX = Math.max(150, baseWidth + 80);
        const stepY = Math.max(150, baseHeight + 80);
        for (let x = 40; x < width; x += stepX) {
          for (let y = 40; y < height; y += stepY) {
            page.drawImage(embeddedImage, {
              x,
              y,
              width: baseWidth,
              height: baseHeight,
              opacity: options.opacity,
              rotate: degrees(options.angle)
            });
          }
        }
      } else {
        page.drawImage(embeddedImage, {
          x: (width - baseWidth) / 2,
          y: (height - baseHeight) / 2,
          width: baseWidth,
          height: baseHeight,
          opacity: options.opacity,
          rotate: degrees(options.angle)
        });
      }
    }
  }

  return await pdf.save();
}
