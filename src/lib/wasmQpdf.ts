import type wasmDefault from '@jspawn/qpdf-wasm';

export type EncryptionStrength = '128' | '256';

interface QpdfModule {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
  callMain(args: string[]): number;
}

type QpdfFactory = typeof wasmDefault;

const QPDF_WASM_URL = '/wasm/qpdf/qpdf.wasm';

let modulePromise: Promise<QpdfModule> | null = null;

async function loadQpdf(): Promise<QpdfModule> {
  if (!modulePromise) {
    const imported = (await import('@jspawn/qpdf-wasm')) as unknown as { default: QpdfFactory };
    modulePromise = imported.default({ locateFile: () => QPDF_WASM_URL });
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
