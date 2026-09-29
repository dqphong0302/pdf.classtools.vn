export type EncryptionStrength = '128' | '256';

interface QpdfModule {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
  callMain(args: string[]): number;
}

type QpdfFactory = (options: { locateFile: (path: string) => string }) => Promise<QpdfModule>;

const QPDF_BASE_URL = '/wasm/qpdf/';

let modulePromise: Promise<QpdfModule> | null = null;

/**
 * The npm wrapper (qpdf.mjs) relies on a CommonJS `globalThis.exports` side effect that
 * bundlers strip, so it never finds the factory. The emscripten build itself is a plain
 * script that declares a global `Module` factory; load that directly.
 */
function loadFactory(): Promise<QpdfFactory> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${QPDF_BASE_URL}qpdf.js`;
    script.async = true;
    script.onload = () => {
      const scope = window as unknown as { Module?: QpdfFactory };
      const factory = scope.Module;
      // `var Module` in a classic script is non-configurable, so it cannot be deleted.
      scope.Module = undefined;
      script.remove();
      if (typeof factory === 'function') resolve(factory);
      else reject(new Error('QPDF_FACTORY_MISSING'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('QPDF_SCRIPT_FAILED'));
    };
    document.head.appendChild(script);
  });
}

async function loadQpdf(): Promise<QpdfModule> {
  if (!modulePromise) {
    modulePromise = loadFactory()
      .then((factory) => factory({ locateFile: (path) => `${QPDF_BASE_URL}${path}` }))
      .catch((error: unknown) => {
        // Let the next call retry instead of caching a failed download forever.
        modulePromise = null;
        throw error;
      });
  }
  return modulePromise;
}

function runQpdf(module: QpdfModule, args: string[]): void {
  const exitCode = module.callMain(args);
  // qpdf exit 3 = "successful with warnings" (e.g. recovering damaged files).
  if (exitCode !== 0 && exitCode !== 3) throw new Error(`QPDF_FAILED:${exitCode}`);
}

/**
 * Encrypts a PDF with a user password (open) and owner password (permissions).
 * Runs qpdf compiled to WASM entirely in the browser.
 */
export async function encryptPdf(
  bytes: Uint8Array,
  passwords: { user: string; owner: string },
  strength: EncryptionStrength = '256'
): Promise<Uint8Array> {
  const module = await loadQpdf();
  module.FS.writeFile('/in.pdf', bytes);
  runQpdf(module, ['--encrypt', passwords.user, passwords.owner, strength, '--', '/in.pdf', '/out.pdf']);
  const output = module.FS.readFile('/out.pdf');
  module.FS.unlink('/in.pdf');
  module.FS.unlink('/out.pdf');
  return new Uint8Array(output);
}

/** Removes password protection. The password must be provided when the file requires one. */
export async function decryptPdf(bytes: Uint8Array, password = ''): Promise<Uint8Array> {
  const module = await loadQpdf();
  module.FS.writeFile('/in.pdf', bytes);
  const args = password
    ? [`--password=${password}`, '--decrypt', '/in.pdf', '/out.pdf']
    : ['--decrypt', '/in.pdf', '/out.pdf'];
  runQpdf(module, args);
  const output = module.FS.readFile('/out.pdf');
  module.FS.unlink('/in.pdf');
  module.FS.unlink('/out.pdf');
  return new Uint8Array(output);
}

/**
 * Repairs damaged or corrupt PDF files.
 *
 * qpdf normally rebuilds a broken cross-reference table itself, but this WASM build
 * exits with an error (code 2) instead of recovering. pdf-lib scans objects
 * sequentially and ignores the xref, so it is used as the fallback: loading and
 * re-saving writes a fresh, valid xref.
 */
export async function repairPdf(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const module = await loadQpdf();
    module.FS.writeFile('/in.pdf', bytes);
    try {
      runQpdf(module, ['--linearize', '/in.pdf', '/out.pdf']);
      return new Uint8Array(module.FS.readFile('/out.pdf'));
    } finally {
      for (const path of ['/in.pdf', '/out.pdf']) {
        try {
          module.FS.unlink(path);
        } catch {
          // file was never created
        }
      }
    }
  } catch {
    const { PDFDocument } = await import('pdf-lib');
    const load = (data: Uint8Array) => PDFDocument.load(data, { ignoreEncryption: true, throwOnInvalidObject: false });
    let doc;
    try {
      doc = await load(bytes);
    } catch {
      // Tail of the file is missing (no trailer): rebuild one from the catalog object.
      const patched = appendSyntheticTrailer(bytes);
      if (!patched) throw new Error('REPAIR_FAILED');
      doc = await load(patched);
    }
    if (doc.getPageCount() === 0) throw new Error('REPAIR_NO_PAGES');
    return await doc.save();
  }
}

/** Appends a trailer pointing at the /Catalog found by scanning the raw objects, or null. */
function appendSyntheticTrailer(bytes: Uint8Array): Uint8Array | null {
  const text = new TextDecoder('latin1').decode(bytes);
  let root: number | null = null;
  let size = 0;
  for (const match of text.matchAll(/(\d+)\s+(\d+)\s+obj\b([\s\S]*?)endobj/g)) {
    const id = Number(match[1]);
    size = Math.max(size, id + 1);
    if (/\/Type\s*\/Catalog\b/.test(match[3])) root = id;
  }
  const lastEnd = text.lastIndexOf('endobj');
  if (root === null || lastEnd < 0) return null;
  // Drop any half-written object / partial xref after the last complete object.
  const body = bytes.subarray(0, lastEnd + 'endobj'.length);
  const tail = new TextEncoder().encode(`\ntrailer\n<< /Size ${size} /Root ${root} 0 R >>\n%%EOF\n`);
  const out = new Uint8Array(body.length + tail.length);
  out.set(body);
  out.set(tail, body.length);
  return out;
}
