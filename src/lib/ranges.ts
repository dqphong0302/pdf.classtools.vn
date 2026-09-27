export interface ParsedRange {
  indices: number[];
  error: string | null;
}

/**
 * Parses a 1-based page selection like "1-3, 5, 8-" into unique sorted 0-based indices.
 * Returns indices = null and an error message when the input is invalid.
 */
export function parsePageRanges(input: string, pageCount: number): ParsedRange {
  const trimmed = input.trim();
  if (!trimmed) return { indices: [], error: 'empty' };

  const normalized = trimmed.replace(/\s*-\s*/g, '-');
  const seen = new Set<number>();
  for (const part of normalized.split(/[,\s]+/)) {
    if (!part) continue;

    const openRange = /^(\d+)\s*-$/.exec(part);
    if (openRange) {
      const start = Number(openRange[1]);
      if (start < 1 || start > pageCount) return { indices: [], error: 'bounds' };
      for (let page = start; page <= pageCount; page += 1) seen.add(page - 1);
      continue;
    }

    const fullRange = /^(\d+)(?:\s*-\s*(\d+|\.)?)$/.exec(part);
    if (fullRange) {
      const start = Number(fullRange[1]);
      if (start < 1) return { indices: [], error: 'format' };
      if (fullRange[2] === '.' || fullRange[2] === '') {
        if (start > pageCount) return { indices: [], error: 'bounds' };
        for (let page = start; page <= pageCount; page += 1) seen.add(page - 1);
        continue;
      }
      const end = Number(fullRange[2]);
      if (end < start) return { indices: [], error: 'order' };
      if (end > pageCount) return { indices: [], error: 'bounds' };
      for (let page = start; page <= end; page += 1) seen.add(page - 1);
      continue;
    }

    const single = /^(\d+)$/.exec(part);
    if (single) {
      const page = Number(single[1]);
      if (page < 1 || page > pageCount) return { indices: [], error: 'bounds' };
      seen.add(page - 1);
      continue;
    }

    return { indices: [], error: 'format' };
  }

  return { indices: [...seen].sort((a, b) => a - b), error: null };
}

/** Splits 0-based indices into consecutive runs, e.g. [0,1,2,5] -> [[0,1,2],[5]]. */
export function groupConsecutive(indices: number[]): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  indices.forEach((value) => {
    if (current.length && value === current[current.length - 1] + 1) {
      current.push(value);
    } else {
      if (current.length) groups.push(current);
      current = [value];
    }
  });
  if (current.length) groups.push(current);
  return groups;
}

/** Formats 0-based indices back to a compact 1-based label like "1-3, 5". */
export function formatPageLabel(indices: number[]): string {
  return groupConsecutive(indices)
    .map((group) => (group.length > 1 ? `${group[0] + 1}-${group[group.length - 1] + 1}` : `${group[0] + 1}`))
    .join(', ');
}

/** Chunks 0-based indices into consecutive groups of at most `size`. */
export function chunkEvery(indices: number[], size: number): number[][] {
  const safeSize = Math.max(1, Math.floor(size));
  const chunks: number[][] = [];
  for (let index = 0; index < indices.length; index += safeSize) {
    chunks.push(indices.slice(index, index + safeSize));
  }
  return chunks;
}
