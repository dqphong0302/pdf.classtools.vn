import { PDFDocument, PDFFont, PDFImage, PDFPage, degrees, rgb } from 'pdf-lib';
import boldFontUrl from '../assets/fonts/Roboto-Bold.ttf?url';
import regularFontUrl from '../assets/fonts/Roboto-Regular.ttf?url';

export interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export interface Placement {
  x: number;
  y: number;
}

const LINE_HEIGHT_RATIO = 1.25;

export function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const clean = hex.replace('#', '').trim();
  const full = /^[0-9a-f]{6}$/i.test(clean) ? clean : '25223f';
  return {
    red: parseInt(full.slice(0, 2), 16) / 255,
    green: parseInt(full.slice(2, 4), 16) / 255,
    blue: parseInt(full.slice(4, 6), 16) / 255
  };
}

export function hexToPdfRgb(hex: string) {
  const { red, green, blue } = hexToRgb(hex);
  return rgb(red, green, blue);
}

/** Converts a top-left percentage placement into pdf-lib bottom-left coordinates,
 *  keeping the whole box inside the page bounds. */
export function placementFromPct(
  pageWidth: number,
  pageHeight: number,
  xPct: number,
  yPct: number,
  boxWidthPt: number,
  boxHeightPt: number
): Placement {
  const rawX = (clampPct(xPct) / 100) * pageWidth;
  const rawY = pageHeight - (clampPct(yPct) / 100) * pageHeight - boxHeightPt;
  const x = Math.max(0, Math.min(pageWidth - Math.min(boxWidthPt, pageWidth), rawX));
  const y = Math.max(0, Math.min(pageHeight - Math.min(boxHeightPt, pageHeight), rawY));
  return { x, y };
}

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function splitLines(text: string): string[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .slice(0, 50);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

export function textBlockHeight(lineCount: number, fontSizePt: number): number {
  return Math.max(1, lineCount) * fontSizePt * LINE_HEIGHT_RATIO;
}

async function fetchFont(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`FONT_FETCH_FAILED:${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Registers fontkit (loaded on demand, ~700 KB) and embeds subsetted Roboto Regular/Bold (full Vietnamese support). */
export async function ensureEmbeddedFonts(pdf: PDFDocument): Promise<PdfFonts> {
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    fetchFont(regularFontUrl),
    fetchFont(boldFontUrl)
  ]);
  const [regularFont, boldFont] = await Promise.all([
    pdf.embedFont(regular, { subset: true }),
    pdf.embedFont(bold, { subset: true })
  ]);
  return { regular: regularFont, bold: boldFont };
}

export interface TextLayer {
  pageIndex: number;
  text: string;
  xPct: number;
  yPct: number;
  fontSizePt: number;
  colorHex: string;
  bold: boolean;
}

export async function addTextLayers(pdf: PDFDocument, fonts: PdfFonts, layers: TextLayer[]): Promise<void> {
  const pages = pdf.getPages();
  layers.forEach((layer) => {
    const page: PDFPage | undefined = pages[layer.pageIndex];
    if (!page || !layer.text.trim()) return;
    const font = layer.bold ? fonts.bold : fonts.regular;
    const size = Math.max(4, Math.min(96, layer.fontSizePt));
    const lines = splitLines(layer.text);
    const blockHeight = textBlockHeight(lines.length, size);
    const { x, y } = placementFromPct(
      page.getWidth(),
      page.getHeight(),
      clampPct(layer.xPct),
      clampPct(layer.yPct),
      0,
      blockHeight
    );
    let cursorY = y + blockHeight - size;
    lines.forEach((line) => {
      page.drawText(line, { x, y: cursorY, size, font, color: hexToPdfRgb(layer.colorHex) });
      cursorY -= size * LINE_HEIGHT_RATIO;
    });
  });
}

export type ImageFormat = 'png' | 'jpg';

export function detectImageFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return 'png';
}

export interface ImageLayer {
  pageIndex: number;
  bytes: Uint8Array;
  xPct: number;
  yPct: number;
  widthPct: number;
}

export async function addImageLayers(pdf: PDFDocument, layers: ImageLayer[]): Promise<void> {
  const pages = pdf.getPages();
  for (const layer of layers) {
    const page: PDFPage | undefined = pages[layer.pageIndex];
    if (!page || !layer.bytes.byteLength) continue;
    const embedded: PDFImage = detectImageFormat(layer.bytes) === 'jpg'
      ? await pdf.embedJpg(layer.bytes)
      : await pdf.embedPng(layer.bytes);
    const targetWidth = (clampPct(layer.widthPct) / 100) * page.getWidth();
    const scale = targetWidth / embedded.width;
    const drawnHeight = embedded.height * scale;
    const { x, y } = placementFromPct(
      page.getWidth(),
      page.getHeight(),
      clampPct(layer.xPct),
      clampPct(layer.yPct),
      targetWidth,
      drawnHeight
    );
    page.drawImage(embedded, { x, y, width: targetWidth, height: drawnHeight });
  }
}

export interface WatermarkOptions {
  text: string;
  fontSizePt: number;
  colorHex: string;
  opacity: number;
  angle: number;
}

export async function addWatermark(pdf: PDFDocument, font: PDFFont, options: WatermarkOptions): Promise<void> {
  const text = options.text.trim();
  if (!text) return;
  const size = Math.max(12, Math.min(160, options.fontSizePt));
  const opacity = Math.max(0.05, Math.min(1, options.opacity));
  const rad = (options.angle * Math.PI) / 180;
  const textWidth = font.widthOfTextAtSize(text, size);

  pdf.getPages().forEach((page) => {
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const x = pageWidth / 2 - (textWidth / 2) * Math.cos(rad) + (size / 2) * Math.sin(rad);
    const y = pageHeight / 2 - (textWidth / 2) * Math.sin(rad) - (size / 2) * Math.cos(rad);
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: hexToPdfRgb(options.colorHex),
      opacity,
      rotate: degrees(options.angle)
    });
  });
}

export interface ImageWatermarkOptions {
  bytes: Uint8Array;
  /** Width as percentage of page width. */
  widthPct: number;
  opacity: number;
  angle: number;
  /** Percentage of page dims the stamp centers on. */
  xPct: number;
  yPct: number;
}

export async function addImageWatermark(pdf: PDFDocument, options: ImageWatermarkOptions): Promise<void> {
  if (!options.bytes.byteLength) return;
  const embedded = detectImageFormat(options.bytes) === 'jpg'
    ? await pdf.embedJpg(options.bytes)
    : await pdf.embedPng(options.bytes);
  const opacity = Math.max(0.05, Math.min(1, options.opacity));

  pdf.getPages().forEach((page) => {
    const width = (clampPct(options.widthPct) / 100) * page.getWidth();
    const scale = width / embedded.width;
    const height = embedded.height * scale;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const centerX = (clampPct(options.xPct) / 100) * pageWidth;
    const centerY = (clampPct(options.yPct) / 100) * pageHeight;
    page.drawImage(embedded, {
      x: centerX - width / 2,
      y: pageHeight - centerY - height / 2,
      width,
      height,
      opacity,
      rotate: degrees(options.angle)
    });
  });
}

export type NumberPosition = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';

export interface PageNumberOptions {
  position: NumberPosition;
  startAt: number;
  template: string;
  fontSizePt: number;
  skipFirst: boolean;
  colorHex: string;
}

export function renderNumberTemplate(template: string, current: number, total: number): string {
  return template
    .replace(/\{n\}/g, String(current))
    .replace(/\{total\}/g, String(total))
    .replace(/\{page\}/gi, String(current))
    .replace(/\{pages\}/gi, String(total))
    .trim() || String(current);
}

export async function addPageNumbers(pdf: PDFDocument, font: PDFFont, options: PageNumberOptions): Promise<void> {
  const pages = pdf.getPages();
  const total = pages.length;
  const size = Math.max(6, Math.min(32, options.fontSizePt));
  const margin = 24;

  pages.forEach((page, index) => {
    if (options.skipFirst && index === 0) return;
    const label = renderNumberTemplate(options.template, options.startAt + index, total);
    const textWidth = font.widthOfTextAtSize(label, size);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    const isTop = options.position.startsWith('top');
    const x = options.position.endsWith('left')
      ? margin
      : options.position.endsWith('right')
        ? pageWidth - margin - textWidth
        : (pageWidth - textWidth) / 2;
    const y = isTop ? pageHeight - margin - size : margin;

    page.drawText(label, { x, y, size, font, color: hexToPdfRgb(options.colorHex) });
  });
}
