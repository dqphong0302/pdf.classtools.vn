import type { PDFPage } from 'pdf-lib';

export interface PageFrame {
  /** Width/height of the page as the reader sees it (after /Rotate). */
  width: number;
  height: number;
  /** Page /Rotate normalised to 0, 90, 180 or 270. */
  rotation: number;
  /** Maps a visual point (bottom-left origin) to PDF user-space coordinates. */
  toPdf(vx: number, vy: number): { x: number; y: number };
}

/**
 * Describes the page in "visual" coordinates so overlays land where the reader
 * expects on rotated pages and pages whose CropBox does not start at (0, 0).
 * Anything drawn at `toPdf(...)` must be rotated by `rotation` extra degrees to
 * appear upright.
 */
export function pageFrame(page: PDFPage): PageFrame {
  const rotation = (((page.getRotation().angle % 360) + 360) % 360) as number;
  const box = page.getCropBox();
  const swap = rotation === 90 || rotation === 270;
  return {
    width: swap ? box.height : box.width,
    height: swap ? box.width : box.height,
    rotation,
    toPdf(vx, vy) {
      switch (rotation) {
        case 90:
          return { x: box.x + box.width - vy, y: box.y + vx };
        case 180:
          return { x: box.x + box.width - vx, y: box.y + box.height - vy };
        case 270:
          return { x: box.x + vy, y: box.y + box.height - vx };
        default:
          return { x: box.x + vx, y: box.y + vy };
      }
    }
  };
}

/**
 * pdf-lib rotates text/images around their bottom-left origin. Returns the origin
 * that keeps a `width × height` box centred on (cx, cy) after rotating by `angleDeg`.
 */
export function centeredOrigin(cx: number, cy: number, width: number, height: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = width / 2;
  const hh = height / 2;
  return {
    x: cx - (cos * hw - sin * hh),
    y: cy - (sin * hw + cos * hh)
  };
}
