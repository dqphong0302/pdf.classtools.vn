const RECENT_KEY = 'classtools-recent';

export function readRecentTools(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberTool(path: string) {
  try {
    const next = [path, ...readRecentTools().filter((item) => item !== path)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — recents are a convenience only
  }
}

