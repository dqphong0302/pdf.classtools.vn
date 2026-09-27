import { describe, expect, it } from 'vitest';
import {
  clampPct,
  detectImageFormat,
  hexToRgb,
  placementFromPct,
  renderNumberTemplate,
  splitLines,
  textBlockHeight
} from './pdfEdit';

describe('hexToRgb', () => {
  it('converts hex colors to 0-1 channels', () => {
    expect(hexToRgb('#ff0000')).toEqual({ red: 1, green: 0, blue: 0 });
    expect(hexToRgb('25223F')).toBeInstanceOf(Object);
  });

  it('falls back to a safe ink color for invalid values', () => {
    const fallback = hexToRgb('zzz');
    expect(fallback.red).toBeCloseTo(0.145);
    expect(fallback.green).toBeCloseTo(0.133);
  });
});

describe('placementFromPct', () => {
  it('converts top-left percentages to bottom-left PDF coordinates', () => {
    // Page 595x842, box 100x50 at x=10%, y=20% from top.
    const placement = placementFromPct(595, 842, 10, 20, 100, 50);
    expect(placement.x).toBeCloseTo(59.5);
    expect(placement.y).toBeCloseTo(842 - 168.4 - 50);
  });

  it('keeps the box inside the page at the bottom edge', () => {
    const placement = placementFromPct(595, 842, 0, 100, 50, 50);
    expect(placement.y).toBeCloseTo(0);
    expect(placement.x).toBeCloseTo(0);
  });
});

describe('clampPct', () => {
  it('clamps percentages into 0-100', () => {
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(120)).toBe(100);
    expect(clampPct(Number.NaN)).toBe(0);
    expect(clampPct(42.5)).toBe(42.5);
  });
});

describe('splitLines and textBlockHeight', () => {
  it('splits text into max 50 non-empty trailing-trimmed lines', () => {
    expect(splitLines('a\r\nb\n')).toEqual(['a', 'b']);
    expect(splitLines('one')).toEqual(['one']);
    expect(splitLines('')).toEqual([]);
  });

  it('computes block height with line spacing', () => {
    expect(textBlockHeight(2, 12)).toBeCloseTo(30);
    expect(textBlockHeight(0, 12)).toBe(15);
  });
});

describe('detectImageFormat', () => {
  it('detects JPEG and defaults to PNG', () => {
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(detectImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('png');
    expect(detectImageFormat(new Uint8Array([1, 2, 3]))).toBe('png');
  });
});

describe('renderNumberTemplate', () => {
  it('expands templates with current and total numbers', () => {
    expect(renderNumberTemplate('{n} / {total}', 2, 5)).toBe('2 / 5');
    expect(renderNumberTemplate('Trang {page}', 3, 5)).toBe('Trang 3');
    expect(renderNumberTemplate('Page {n} of {pages}', 1, 9)).toBe('Page 1 of 9');
    expect(renderNumberTemplate('', 4, 5)).toBe('4');
  });
});
