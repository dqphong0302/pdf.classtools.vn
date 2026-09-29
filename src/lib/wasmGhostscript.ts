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
    // Absolute URL: in dev, Vite rewrites root-relative dynamic imports to
    // `?import` and refuses to serve /public files that way.
    modulePromise = loadGhostscriptWASM({ baseUrl: new URL(GS_BASE_URL, window.location.origin).href }).catch((error: unknown) => {
      // Let the next call retry instead of caching a failed download forever.
      modulePromise = null;
      throw error;
    });
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

// PDF/A requires an OutputIntent with an embedded ICC profile. Ghostscript ships
// sRGB in its ROM filesystem; this mirrors the PDFA_def.ps from the gs distribution.
const PDFA_DEF_PS = `%!
[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark
[{icc_PDFA} <</N 3>> /PUT pdfmark
[{icc_PDFA} (%rom%iccprofiles/srgb.icc) (r) file /PUT pdfmark
[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark
[{OutputIntent_PDFA} << /Type /OutputIntent /S /GTS_PDFA1 /DestOutputProfile {icc_PDFA} /OutputConditionIdentifier (sRGB) /Info (sRGB IEC61966-2.1) >> /PUT pdfmark
[{Catalog} <</OutputIntents [ {OutputIntent_PDFA} ]>> /PUT pdfmark
`;

/** Converts a PDF to the ISO standard PDF/A-2b format using Ghostscript WASM. */
export async function convertToPdfa(bytes: Uint8Array): Promise<Uint8Array> {
  const module = await loadGhostscript();
  module.FS.writeFile('/in.pdf', bytes);
  module.FS.writeFile('/PDFA_def.ps', new TextEncoder().encode(PDFA_DEF_PS));
  const exitCode = module.callMain([
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-sDEVICE=pdfwrite',
    '-dPDFA=2',
    '-dPDFACompatibilityPolicy=1',
    '-sColorConversionStrategy=RGB',
    '-dEmbedAllFonts=true',
    '-dSubsetFonts=true',
    '-sOutputFile=/out.pdf',
    '/PDFA_def.ps',
    '/in.pdf'
  ]);
  if (exitCode !== 0) throw new Error(`GS_PDFA_FAILED:${exitCode}`);
  const output = module.FS.readFile('/out.pdf');
  module.FS.unlink('/in.pdf');
  module.FS.unlink('/out.pdf');
  return new Uint8Array(output);
}
