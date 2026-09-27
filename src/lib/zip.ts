import JSZip from 'jszip';
import { sanitizeFilename } from './download';

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

/** Packs files into a ZIP archive (DEFLATE). Runs fully in memory. */
export async function zipFiles(entries: ZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip();
  entries.forEach(({ name, bytes }) => zip.file(sanitizeFilename(name), bytes));
  const output = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return output;
}
