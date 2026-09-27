import { describe, expect, it } from 'vitest';
import { chunkEvery, formatPageLabel, groupConsecutive, parsePageRanges } from './ranges';

describe('parsePageRanges', () => {
  it('parses single pages, ranges and open ranges', () => {
    expect(parsePageRanges('2', 5)).toEqual({ indices: [1], error: null });
    expect(parsePageRanges('1-3', 5)).toEqual({ indices: [0, 1, 2], error: null });
    expect(parsePageRanges('4-', 5)).toEqual({ indices: [3, 4], error: null });
    expect(parsePageRanges('1-3, 5, 2', 5)).toEqual({ indices: [0, 1, 2, 4], error: null });
    expect(parsePageRanges('2 - 4', 5)).toEqual({ indices: [1, 2, 3], error: null });
  });

  it('treats whitespace and commas as separators', () => {
    expect(parsePageRanges('1 3,5', 5).indices).toEqual([0, 2, 4]);
  });

  it('rejects invalid input', () => {
    expect(parsePageRanges('', 5).error).toBe('empty');
    expect(parsePageRanges('abc', 5).error).toBe('format');
    expect(parsePageRanges('0', 5).error).toBe('bounds');
    expect(parsePageRanges('1-0', 5).error).toBe('order');
    expect(parsePageRanges('9', 5).error).toBe('bounds');
    expect(parsePageRanges('1-9', 5).error).toBe('bounds');
  });

  it('handles full document selection', () => {
    expect(parsePageRanges('1-', 3).indices).toEqual([0, 1, 2]);
  });
});

describe('groupConsecutive and formatPageLabel', () => {
  it('groups consecutive page indices', () => {
    expect(groupConsecutive([0, 1, 2, 5, 7, 8])).toEqual([[0, 1, 2], [5], [7, 8]]);
    expect(groupConsecutive([])).toEqual([]);
  });

  it('formats compact human labels', () => {
    expect(formatPageLabel([0, 1, 2, 4])).toBe('1-3, 5');
    expect(formatPageLabel([3])).toBe('4');
  });
});

describe('chunkEvery', () => {
  it('chunks indices into fixed groups', () => {
    expect(chunkEvery([0, 1, 2, 3, 4], 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(chunkEvery([0, 1, 2], 0)).toEqual([[0], [1], [2]]);
  });
});
