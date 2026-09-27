import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { zipFiles } from './zip';

describe('zipFiles', () => {
  it('packs multiple files with sanitized names', async () => {
    const zipBytes = await zipFiles([
      { name: 'part-1-2.pdf', bytes: new Uint8Array([1, 2, 3]) },
      { name: 'bài kiểm tra?.pdf', bytes: new Uint8Array([4, 5]) }
    ]);

    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files).sort()).toEqual(['bài-kiểm-tra.pdf', 'part-1-2.pdf']);
    expect(await zip.file('part-1-2.pdf')!.async('uint8array')).toEqual(new Uint8Array([1, 2, 3]));
    expect(await zip.file('bài-kiểm-tra.pdf')!.async('uint8array')).toEqual(new Uint8Array([4, 5]));
  });

  it('creates an empty archive for no entries', async () => {
    const zipBytes = await zipFiles([]);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});
