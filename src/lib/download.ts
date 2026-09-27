export function downloadBytes(bytes: Uint8Array, filename: string, mime = 'application/pdf'): void {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeFilename(filename);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-\.(?=pdf$)/i, '.')
    .replace(/^-|-$/g, '');
  return cleaned || 'file';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function withPdfSuffix(name: string): string {
  const base = name.replace(/\.pdf$/i, '');
  return sanitizeFilename(base) + '.pdf';
}

export function fileSummary(file: File): string {
  return `${file.name} · ${formatBytes(file.size)}`;
}
