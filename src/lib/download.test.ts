import { describe, expect, it } from 'vitest';
import { formatBytes, sanitizeFilename, withPdfSuffix } from './download';

describe('sanitizeFilename', () => {
  it('strips dangerous characters and collapses dashes', () => {
    expect(sanitizeFilename('bài kiểm tra: cuối/kỳ?.pdf')).toBe('bài-kiểm-tra-cuối-kỳ.pdf');
    expect(sanitizeFilename('   spaced    name   ')).toBe('spaced-name');
    expect(sanitizeFilename('///')).toBe('file');
  });
});

describe('formatBytes', () => {
  it('formats human readable sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('withPdfSuffix', () => {
  it('ensures a single .pdf suffix', () => {
    expect(withPdfSuffix('tài liệu.pdf')).toBe('tài-liệu.pdf');
    expect(withPdfSuffix('tài liệu')).toBe('tài-liệu.pdf');
  });
});
