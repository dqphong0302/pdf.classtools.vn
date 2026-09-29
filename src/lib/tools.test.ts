import { describe, expect, it } from 'vitest';
import { CATEGORIES, TOOLS, normalizeText, searchTools, toolForPath } from './tools';

describe('tool catalog', () => {
  it('has unique routes and every tool belongs to a known category', () => {
    const routes = TOOLS.map((tool) => tool.to);
    expect(new Set(routes).size).toBe(routes.length);
    const categories = new Set(CATEGORIES.map((category) => category.id));
    expect(TOOLS.every((tool) => categories.has(tool.category))).toBe(true);
  });

  it('resolves a tool from a path, ignoring a trailing slash', () => {
    expect(toolForPath('/merge/')?.to).toBe('/merge');
    expect(toolForPath('/')).toBeUndefined();
  });

  it('searches without caring about accents or case', () => {
    expect(normalizeText('Đóng dấu')).toBe('dong dau');
    expect(searchTools('nen').map((tool) => tool.to)).toContain('/compress');
    expect(searchTools('GHEP')[0].to).toBe('/merge');
    expect(searchTools('excel').map((tool) => tool.to).sort()).toEqual(['/excel-to-pdf', '/pdf-to-excel']);
  });

  it('requires every word to match and returns everything for an empty query', () => {
    expect(searchTools('   ')).toHaveLength(TOOLS.length);
    expect(searchTools('nen xyz')).toHaveLength(0);
  });
});
