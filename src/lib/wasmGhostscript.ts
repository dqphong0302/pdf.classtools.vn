export type CompressionPreset = 'printer' | 'ebook' | 'screen';

export interface CompressionResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
}

interface GhostscriptModule {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
  callMain(args: string[]): number;
}

const PRESETS: Record<CompressionPreset, string> = {
  printer: 'printer',
  ebook: 'ebook',
  screen: 'screen'
};

const GS_BASE_URL = '/wasm/gs/';

let modulePromise: Promise<GhostscriptModule> | null = null;

async function loadGhostscript(): Promise<GhostscriptModule> {
  if (!modulePromise) {
    const { loadGhostscriptWASM } = await import('@bentopdf/gs-wasm');
    modulePromise = loadGhostscriptWASM({ baseUrl: GS_BASE_URL });
  }
  return modulePromise;
}

/** Compresses a PDF with Ghostscript compiled to WASM (runs fully in the browser). */
export async function compressPdf(bytes: Uint8Array, preset: CompressionPreset = 'ebook'): Promise<CompressionResult> {
  const module = await loadGhostscript();
  module.FS.writeFile('/in.pdf', bytes);
  const exitCode = module.callMain([
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.5',
    `-dPDFSETTINGS=/${PRESETS[preset]}`,
    '-dEmbedAllFonts=true',
    '-dSubsetFonts=true',
    '-sOutputFile=/out.pdf',
    '/in.pdf'
  ]);
  if (exitCode !== 0) throw new Error(`GS_FAILED:${exitCode}`);
  const output = module.FS.readFile('/out.pdf');
  module.FS.unlink('/in.pdf');
  module.FS.unlink('/out.pdf');
  return {
    bytes: new Uint8Array(output),
    originalSize: bytes.byteLength,
    compressedSize: output.byteLength
  };
}
