export interface CompareResult {
  mismatchPixels: number;
  totalPixels: number;
  mismatchPercentage: number;
}

/**
 * Computes a visual pixel difference between two ImageData objects and renders it
 * to a target diff context. Pixels in common appear muted, differences glow in bright red/orange.
 */
export function computeVisualDiff(
  imgA: ImageData,
  imgB: ImageData,
  diffCtx: CanvasRenderingContext2D
): CompareResult {
  const width = Math.min(imgA.width, imgB.width);
  const height = Math.min(imgA.height, imgB.height);
  const totalPixels = width * height;

  const diffImg = diffCtx.createImageData(width, height);
  const dataA = imgA.data;
  const dataB = imgB.data;
  const dataDiff = diffImg.data;

  let mismatch = 0;
  const threshold = 16; // tolerance for anti-aliasing

  for (let i = 0; i < totalPixels * 4; i += 4) {
    const dr = Math.abs(dataA[i] - dataB[i]);
    const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
    const da = Math.abs(dataA[i + 3] - dataB[i + 3]);

    if (dr > threshold || dg > threshold || db > threshold || da > threshold) {
      mismatch++;
      // Highlight difference in vibrant magenta/red
      dataDiff[i] = 239;     // R
      dataDiff[i + 1] = 68;   // G
      dataDiff[i + 2] = 68;   // B
      dataDiff[i + 3] = 255;  // A
    } else {
      // Muted background grayscale
      const gray = (dataA[i] + dataA[i + 1] + dataA[i + 2]) / 3;
      dataDiff[i] = gray;
      dataDiff[i + 1] = gray;
      dataDiff[i + 2] = gray;
      dataDiff[i + 3] = 70; // semi-transparent
    }
  }

  diffCtx.putImageData(diffImg, 0, 0);

  return {
    mismatchPixels: mismatch,
    totalPixels,
    mismatchPercentage: totalPixels > 0 ? (mismatch / totalPixels) * 100 : 0
  };
}
